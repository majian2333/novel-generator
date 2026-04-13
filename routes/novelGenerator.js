const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 生成小说的API路由 - 支持流式输出和自定义提示词
router.post('/generate', async (req, res) => {
  try {
    console.log('收到生成小说请求:', req.body);
    
    const { genre = '奇幻', theme = '冒险', length = '中等', prompt = null } = req.body;
    
    // 构建提示词
    let finalPrompt;
    if (prompt && prompt.trim()) {
      // 如果用户提供了自定义提示词，使用自定义提示词
      finalPrompt = prompt.trim();
    } else {
      // 否则使用默认的提示词 - 优化后生成更像正式小说
      const lengthText = {
        '短篇': '短篇，大约1000-2000字',
        '中等': '中篇，大约3000-5000字', 
        '长篇': '长篇，大约6000-8000字'
      };
      finalPrompt = `请直接开始写小说正文，**禁止生成目录、章节列表、大纲**。
你正在创作一篇${genre}类型网络小说，主题是${theme}。
⚠️ 非常重要：
- ❌ 禁止生成"第一章"、"第二章"这样的目录列表，直接写正文内容
- ✅ 直接开始故事，一个场景一个段落，正常分段
- ✅ 要有完整的情节、具体的场景描写、人物对话
- ✅ 每个段落控制在1-3行，不要太长，方便手机阅读
- ✅ 篇幅：${lengthText[length] || length}
- ✅ 直接输出小说内容，不需要任何开场白、说明、标题

例子：
错误写法：
第一章 xxxx
第二章 xxxx
（这种目录是错误的）

正确写法：
清晨的阳光透过窗户洒在地板上，林风睁开眼睛，发现自己躺在一个陌生的房间里。

"这是哪里？"他挣扎着坐起身，脑袋还有些昏沉。

门口传来脚步声，一个穿着旗袍的女人走了进来...

（这样分段写正文才对）`;
    }
    
    // 使用智谱AI API / 火山引擎方舟
    const apiBase = process.env.ZHIPU_AI_API_BASE || 'https://open.bigmodel.cn/api/paas/v4/';
    const apiKey = process.env.ZHIPU_AI_API_KEY;
    
    if (!apiKey) {
      throw new Error('未配置ZHIPU_AI_API_KEY');
    }
    
    console.log('使用API端点:', apiBase);
    console.log('使用模型:', process.env.ZHIPU_AI_MODEL);
    
    // 设置响应头以支持流式输出
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 构建请求参数 (OpenAI兼容格式，适用于火山方舟兼容模式)
    const requestBody = {
      model: process.env.ZHIPU_AI_MODEL || 'doubao-seed-2.0-pro',
      messages: [
        {
          role: 'system',
          content: '你是一位优秀的小说作家，擅长创作各种类型的小说。请根据用户的要求创作精彩的小说内容。'
        },
        {
          role: 'user',
          content: finalPrompt
        }
      ],
      max_tokens: length === '短篇' ? 2000 : length === '中等' ? 4000 : 6000,
      temperature: 0.8,
      stream: true  // 启用流式输出
    };
    
    console.log('请求参数:', JSON.stringify(requestBody, null, 2));
    
    // 发送请求到API
    // 确保apiBase以斜杠结尾
    const normalizedApiBase = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
    const url = `${normalizedApiBase}chat/completions`;
    console.log('请求URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('API响应状态:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API请求失败: ${response.status}, ${errorText}`);
      throw new Error(`API请求失败: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    // 处理流式响应
    const { body } = response;
    
    if (!body) {
      throw new Error('API响应体为空');
    }
    
    console.log('开始流式传输...');
    
    // 使用更兼容的方式处理流，适配 Cloudflare 环境
    return new Promise((resolve, reject) => {
      let byteCount = 0;
      let isCloudflare = typeof process !== 'undefined' && process.env && (process.env.CF_PAGES || process.env.CF_WORKER);
      
      // 监听数据事件
      body.on('data', (chunk) => {
        try {
          byteCount += chunk.length;
          const chunkStr = chunk.toString('utf-8');
          // 确保响应头已发送
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            // Cloudflare 不需要 Connection: keep-alive
            if (!isCloudflare) {
              res.setHeader('Connection', 'keep-alive');
            }
          }
          if (!res.writableEnded && res.write) {
            res.write(chunkStr);
          }
          console.log(`收到数据块: ${chunk.length} bytes, 总计: ${byteCount} bytes`);
        } catch (err) {
          console.error('写出数据失败:', err);
          reject(err);
        }
      });
      
      // 监听结束事件
      body.on('end', () => {
        try {
          console.log(`流式传输完成，总计: ${byteCount} bytes`);
          if (!res.writableEnded && res.write) {
            res.write('data: [DONE]\n\n');
          }
          if (!res.writableEnded && res.end) {
            res.end();
          }
          resolve();
        } catch (err) {
          console.error('结束流失败:', err);
          reject(err);
        }
      });
      
      // 监听错误事件
      body.on('error', (err) => {
        console.error('API流错误:', err);
        if (!res.headersSent && res.status) {
          res.status(500).json({ error: err.message });
        } else if (!res.writableEnded && res.write) {
          try {
            res.write(`data: {"error": "${err.message.replace(/"/g, '\\"')}"}\n\n`);
            res.write('data: [DONE]\n\n');
            if (res.end) {
              res.end();
            }
          } catch (e) {
            console.error('发送错误信息失败:', e);
          }
        }
        reject(err);
      });
    });
    
  } catch (error) {
    console.error('生成小说失败 (全局错误):', error);
    // 如果是流式响应，需要发送错误信息
    if (!res.writableEnded) {
      if (res.headersSent && res.write) {
        try {
          res.write(`data: {"error": "${error.message.replace(/"/g, '\\"')}"}\n\n`);
          res.write('data: [DONE]\n\n');
          if (res.end) {
            res.end();
          }
        } catch (e) {
          console.error('发送错误响应失败:', e);
        }
      } else if (res.status) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }
});

// 获取示例小说的路由
router.get('/sample', (req, res) => {
  const sampleNovel = `
  在遥远的东方，有一个被云雾缭绕的神秘山谷。传说中，这里居住着古老的龙族，守护着世间最珍贵的宝藏。

  年轻的冒险家李明，带着对未知世界的好奇和对梦想的执着，踏上了寻找龙谷的征程。他的背包里装满了勇气和希望，心中燃烧着不灭的火焰。

  经过七七四十九天的艰难跋涉，李明终于来到了龙谷的入口。那是一座巨大的石门，上面刻满了古老的符文，散发着神秘的光芒。

  正当李明准备推开石门时，一个苍老而威严的声音在他耳边响起："勇敢的年轻人，你为何而来？"

  李明挺直了腰板，坚定地回答："我来寻找传说中的宝藏，不是为了财富，而是为了了解生命的真谛。"

  石门缓缓打开，一道耀眼的光芒将李明包围。在那一刻，他感受到了一种前所未有的平静和力量。

  龙谷的秘密，正等待着他去探索……
  `;
  
  res.json({
    success: true,
    content: sampleNovel
  });
});

// 生成模拟小说的辅助函数
function generateSampleNovel(genre, theme, length) {
  const novels = {
    '奇幻': {
      '冒险': {
        '短篇': `在遥远的东方，有一个被云雾缭绕的神秘山谷。传说中，这里居住着古老的龙族，守护着世间最珍贵的宝藏。

年轻的冒险家李明，带着对未知世界的好奇和对梦想的执着，踏上了寻找龙谷的征程。他的背包里装满了勇气和希望，心中燃烧着不灭的火焰。

经过七七四十九天的艰难跋涉，李明终于来到了龙谷的入口。那是一座巨大的石门，上面刻满了古老的符文，散发着神秘的光芒。

正当李明准备推开石门时，一个苍老而威严的声音在他耳边响起："勇敢的年轻人，你为何而来？"

李明挺直了腰板，坚定地回答："我来寻找传说中的宝藏，不是为了财富，而是为了了解生命的真谛。"

石门缓缓打开，一道耀眼的光芒将李明包围。在那一刻，他感受到了一种前所未有的平静和力量。

龙谷的秘密，正等待着他去探索……`,
        '中等': `在遥远的东方，有一个被云雾缭绕的神秘山谷。传说中，这里居住着古老的龙族，守护着世间最珍贵的宝藏。这个传说已经流传了千年，但从未有人真正找到过龙谷的入口。

年轻的冒险家李明，带着对未知世界的好奇和对梦想的执着，踏上了寻找龙谷的征程。他的背包里装满了勇气和希望，心中燃烧着不灭的火焰。他的祖父曾是村里最勇敢的战士，在临终前告诉了他关于龙谷的秘密。

经过七七四十九天的艰难跋涉，李明穿越了茫茫的沙漠，翻过了险峻的山脉，终于来到了龙谷的入口。那是一座巨大的石门，上面刻满了古老的符文，散发着神秘的光芒。石门旁边站着一位白发苍苍的老人，他的眼神中充满了智慧。

正当李明准备推开石门时，一个苍老而威严的声音在他耳边响起："勇敢的年轻人，你为何而来？"

李明挺直了腰板，坚定地回答："我来寻找传说中的宝藏，不是为了财富，而是为了了解生命的真谛。"

老人微笑着点了点头，说："很好，年轻人。真正的宝藏不是金银财宝，而是智慧和勇气。你通过了第一道考验。"

石门缓缓打开，一道耀眼的光芒将李明包围。在那一刻，他感受到了一种前所未有的平静和力量。他知道自己即将开始一段改变命运的冒险。

龙谷的秘密，正等待着他去探索……`,
        '长篇': `在遥远的东方，有一个被云雾缭绕的神秘山谷。传说中，这里居住着古老的龙族，守护着世间最珍贵的宝藏。这个传说已经流传了千年，但从未有人真正找到过龙谷的入口。据说，只有心地纯净、勇气非凡的人才能找到通往龙谷的道路。

年轻的冒险家李明，带着对未知世界的好奇和对梦想的执着，踏上了寻找龙谷的征程。他的背包里装满了勇气和希望，心中燃烧着不灭的火焰。他的祖父曾是村里最勇敢的战士，在临终前告诉了他关于龙谷的秘密，并留下了一张神秘的地图。

经过七七四十九天的艰难跋涉，李明穿越了茫茫的沙漠，翻过了险峻的山脉，穿过了幽暗的森林，经历了无数的危险和考验。他遇到了各种奇异的生物，有善良的精灵，也有邪恶的怪兽。他学会了如何与自然和谐相处，如何用智慧和勇气克服困难。

终于，在一个月黑风高的夜晚，李明来到了龙谷的入口。那是一座巨大的石门，上面刻满了古老的符文，散发着神秘的光芒。石门旁边站着一位白发苍苍的老人，他的眼神中充满了智慧。老人的身后，是一条蜿蜒的小路，通向山谷深处。

正当李明准备推开石门时，一个苍老而威严的声音在他耳边响起："勇敢的年轻人，你为何而来？"

李明挺直了腰板，坚定地回答："我来寻找传说中的宝藏，不是为了财富，而是为了了解生命的真谛。"

老人微笑着点了点头，说："很好，年轻人。真正的宝藏不是金银财宝，而是智慧和勇气。你通过了第一道考验。"

石门缓缓打开，一道耀眼的光芒将李明包围。在那一刻，他感受到了一种前所未有的平静和力量。他知道自己即将开始一段改变命运的冒险。

龙谷的秘密，正等待着他去探索。而这次冒险，将彻底改变他的人生轨迹，让他成长为真正的英雄。`
      },
      '爱情': {
        '短篇': `在繁华的都市中，两个孤独的灵魂相遇了。她是一名才华横溢的画家，他是一名成功的商人。他们的世界原本毫无交集，直到那个雨天的咖啡馆。

她正在为创作灵感而烦恼，他正在为工作压力而疲惫。一杯咖啡的意外碰撞，让他们的目光相遇。在那一刻，时间仿佛静止了。

"对不起，"他轻声说道，"我弄湿了你的画。"

她看着被咖啡浸湿的画纸，却意外地发现，那些咖啡渍形成了一幅美丽的图案。"不，"她微笑着说，"你给了我新的灵感。"

从那天起，他们成为了彼此生命中最重要的人。他用他的成熟稳重，给了她安全感；她用她的天真烂漫，给了他生活的色彩。

爱情，有时候就是这么简单，简单到一杯咖啡的温度。`,
        '中等': `在繁华的都市中，两个孤独的灵魂相遇了。她是一名才华横溢的画家，名叫小雨，在艺术界小有名气，但感情生活却一片空白。他是一名成功的商人，名叫李阳，事业蒸蒸日上，但内心总是感到空虚。

他们的世界原本毫无交集，直到那个雨天的咖啡馆。那天，小雨正在为即将到来的画展创作而烦恼，找不到任何灵感。李阳则刚刚结束了一个重要的商务会议，身心俱疲。

一杯咖啡的意外碰撞，让他们的目光相遇。在那一刻，时间仿佛静止了。

"对不起，"李阳轻声说道，"我弄湿了你的画。"

小雨看着被咖啡浸湿的画纸，却意外地发现，那些咖啡渍形成了一幅美丽的抽象图案。"不，"她微笑着说，"你给了我新的灵感。"

这次意外的相遇，让两个孤独的人找到了彼此的依靠。李阳被小雨的艺术气质和对生活的热爱所吸引，小雨则被李阳的成熟稳重和细心体贴所打动。

他们开始频繁地见面，一起逛美术馆，一起品尝美食，一起分享生活的点滴。李阳会在小雨创作时安静地陪伴，小雨会在李阳疲惫时给予温暖的拥抱。

然而，好景不长，李阳的前女友突然出现，试图挽回他们的关系。小雨也开始怀疑，自己和李阳是否真的合适。

在一次激烈的争吵后，两人决定暂时分开冷静一下。那段时间，他们都陷入了深深的痛苦中。李阳意识到，小雨已经成为他生命中不可或缺的一部分。小雨也明白，她对李阳的爱是真挚的。

最终，在一个阳光明媚的下午，李阳找到了小雨，真诚地说："对不起，我不能没有你。你是我生命中的阳光，给我带来了色彩和温暖。"

小雨泪眼婆娑地笑了："我也不能没有你。你用你的成熟稳重，给了我安全感；我用我的天真烂漫，给了你生活的色彩。"

从此，他们更加珍惜彼此，一起走过了许多风风雨雨。爱情，让他们成为了更好的自己。`,
        '长篇': `在繁华的都市中，两个孤独的灵魂相遇了。她是一名才华横溢的画家，名叫小雨，在艺术界小有名气，但感情生活却一片空白。他是一名成功的商人，名叫李阳，事业蒸蒸日上，但内心总是感到空虚和孤独。

他们的世界原本毫无交集，小雨生活在充满色彩和创意的艺术世界，李阳则生活在充满竞争和压力的商业世界。然而，命运总是喜欢开玩笑，让两个完全不同的人走到了一起。

那是一个雨天的下午，天空灰蒙蒙的，细雨如丝般飘落。小雨正在为即将到来的重要画展创作而烦恼，她已经连续几天找不到任何灵感，画布上依旧一片空白。心情烦躁的她决定去附近的咖啡馆坐坐，希望能找到一些创作的灵感。

李阳则刚刚结束了一个重要的商务会议，这次会议持续了整整六个小时，让他身心俱疲。他需要找个地方放松一下，整理思绪，于是走进了同一家咖啡馆。

一杯咖啡的意外碰撞，让他们的目光相遇。在那一刻，时间仿佛静止了。小雨手中的咖啡杯被李阳不小心碰倒，深褐色的液体洒在了她的画纸上。

"对不起，"李阳轻声说道，急忙拿出纸巾想要擦拭，"我弄湿了你的画。"

小雨看着被咖啡浸湿的画纸，本应该生气，却意外地发现，那些咖啡渍在画纸上形成了一幅美丽的抽象图案，有深有浅，层次分明。"不，"她微笑着说，"你给了我新的灵感。"

这次意外的相遇，让两个孤独的人找到了彼此的依靠。李阳被小雨的艺术气质和对生活的热爱所吸引，小雨则被李阳的成熟稳重和细心体贴所打动。

他们开始频繁地见面，一起逛美术馆，一起品尝美食，一起分享生活的点滴。李阳会在小雨创作时安静地陪伴，看她如何将心中的情感转化为画布上的色彩。小雨会在李阳疲惫时给予温暖的拥抱，用她的温柔化解他的压力。

然而，好景不长，李阳的前女友突然出现，试图挽回他们的关系。她是一个野心勃勃的女人，一直想要控制李阳的生活。小雨也开始怀疑，自己和李阳是否真的合适，她担心自己的艺术梦想会成为两人关系的负担。

在一次激烈的争吵后，两人决定暂时分开冷静一下。那段时间，他们都陷入了深深的痛苦中。李阳意识到，小雨已经成为他生命中不可或缺的一部分。小雨也明白，她对李阳的爱是真挚的，他的成熟稳重给了她安全感，而她的天真烂漫给了他生活的色彩。

最终，在一个阳光明媚的下午，李阳找到了小雨，真诚地说："对不起，我不能没有你。你是我生命中的阳光，给我带来了色彩和温暖。我知道我过去太忙于工作，忽略了你，但我保证，以后会更加珍惜你。"

小雨泪眼婆娑地笑了："我也不能没有你。你用你的成熟稳重，给了我安全感；我用我的天真烂漫，给了你生活的色彩。让我们一起面对未来的挑战吧。"

从此，他们更加珍惜彼此，一起走过了许多风风雨雨。李阳学会了放慢脚步，享受生活的美好。小雨也变得更加成熟，理解了生活的现实。他们的爱情，让彼此成为了更好的自己。

多年后，当他们在夕阳下回顾这段经历时，都会感慨万千。爱情，不仅仅是浪漫和激情，更是相互理解和共同成长的过程。`
      }
    },
    '科幻': {
      '冒险': {
        '短篇': `公元2157年，人类已经成功殖民了火星。年轻的宇航员小明接到了一项特殊任务：前往火星深处的神秘洞穴探险。

"这次任务很危险，"队长严肃地说，"洞穴里可能有未知的生物。"

小明检查了装备，坚定地回答："为了人类的未来，我愿意冒险。"

进入洞穴后，小明发现了一个惊人的景象：洞穴壁上布满了发光的晶体，每个晶体中都封存着一个古老的记忆。通过特殊的设备，小明能够读取这些记忆。

他看到了远古时代火星文明的辉煌，也看到了他们毁灭的原因。原来，火星人是因为过度开发资源而导致了星球的毁灭。

"这是给我们的警告，"小明对着通讯器说，"我们必须吸取教训，保护地球。"

就在这时，洞穴开始崩塌。小明拼命向外跑，在最后关头，他抓住了一块发光的晶体。当他安全返回基地时，发现这块晶体中封存着火星文明的全部知识。

这次冒险，不仅让人类获得了宝贵的知识，也让人类意识到了保护地球的重要性。`,
        '中等': `公元2157年，人类已经成功殖民了火星。年轻的宇航员小明接到了一项特殊任务：前往火星深处的神秘洞穴探险。这个洞穴位于火星最大的峡谷——水手峡谷的深处，据探测，里面可能存在着未知的生命形式。

"这次任务很危险，"队长严肃地说，"洞穴里可能有未知的生物，而且通信信号可能会受到干扰。"

小明检查了装备，坚定地回答："为了人类的未来，我愿意冒险。我从小就想探索宇宙的奥秘。"

进入洞穴后，小明发现了一个惊人的景象：洞穴壁上布满了发光的晶体，每个晶体中都封存着一个古老的记忆。通过特殊的设备，小明能够读取这些记忆。

他看到了远古时代火星文明的辉煌，也看到了他们毁灭的原因。原来，火星人是因为过度开发资源，导致星球磁场消失，大气层被太阳风吹散，最终走向了毁灭。

"这是给我们的警告，"小明对着通讯器说，"我们必须吸取教训，保护地球的生态环境。"

就在这时，洞穴开始崩塌，巨大的石块从顶部坠落。小明拼命向外跑，在最后关头，他抓住了一块发光的晶体。当他安全返回基地时，发现这块晶体中封存着火星文明的全部知识，包括他们先进的科技和哲学思想。

这次冒险，不仅让人类获得了宝贵的知识，也让人类意识到了保护地球的重要性。小明成为了英雄，但他知道，真正的英雄是那些愿意为了未来而改变的人。`,
        '长篇': `公元2157年，人类已经成功殖民了火星。经过近百年的努力，火星基地已经从最初的小型科研站发展成为了拥有数百万人口的现代化城市。人类在火星上建立了完善的生态系统，能够自给自足。

年轻的宇航员小明接到了一项特殊任务：前往火星深处的神秘洞穴探险。这个洞穴位于火星最大的峡谷——水手峡谷的深处，据探测，里面可能存在着未知的生命形式。这个洞穴被命名为"希望之眼"，因为它的形状像一个巨大的眼睛。

"这次任务很危险，"队长严肃地说，"洞穴里可能有未知的生物，而且通信信号可能会受到干扰。我们已经失去了三批探险队，他们都没有回来。"

小明检查了装备，坚定地回答："为了人类的未来，我愿意冒险。我从小就想探索宇宙的奥秘，这是我梦寐以求的机会。"

小明穿上了最先进的宇航服，带上了各种探测设备，独自一人进入了洞穴。洞穴内部异常黑暗，只有他的头灯能够照亮前方几米的距离。随着深入，他发现洞穴的温度逐渐升高，空气也变得潮湿。

进入洞穴后，小明发现了一个惊人的景象：洞穴壁上布满了发光的晶体，每个晶体中都封存着一个古老的记忆。这些晶体散发着柔和的光芒，将整个洞穴映照得如同白昼。通过特殊的设备，小明能够读取这些记忆。

他看到了远古时代火星文明的辉煌。火星人拥有高度发达的科技，他们建立了庞大的城市网络，能够控制天气，甚至能够在太空中建造巨大的结构。他们的艺术和哲学也达到了极高的水平。

然而，小明也看到了他们毁灭的原因。原来，火星人是因为过度开发资源，导致星球磁场消失，大气层被太阳风吹散，最终走向了毁灭。他们的文明只存在了几百万年，就消失在了历史的长河中。

"这是给我们的警告，"小明对着通讯器说，"我们必须吸取教训，保护地球的生态环境。我们不能重蹈火星人的覆辙。"

就在这时，洞穴开始崩塌，巨大的石块从顶部坠落。小明拼命向外跑，在最后关头，他抓住了一块发光的晶体。这块晶体异常沉重，但他知道它的重要性。

当他安全返回基地时，发现这块晶体中封存着火星文明的全部知识，包括他们先进的科技和哲学思想。这些知识对于人类来说是无价之宝，可以帮助人类避免犯同样的错误。

这次冒险，不仅让人类获得了宝贵的知识，也让人类意识到了保护地球的重要性。小明成为了英雄，但他知道，真正的英雄是那些愿意为了未来而改变的人。

在接下来的几年里，人类开始重新审视自己的发展道路。他们开始大力发展可再生能源，减少对化石燃料的依赖。他们开始建立更完善的生态系统，保护生物多样性。

火星文明的故事，成为了人类的一面镜子，让人类看到了自己的未来。而小明，也成为了连接两个文明的桥梁，他的冒险精神，激励着一代又一代的人。`
      }
    }
  };

  return novels[genre]?.[theme]?.[length] || `这是一篇关于${genre}类型的${theme}主题小说。篇幅：${length}。由于系统正在维护，暂时无法生成详细内容，请稍后再试。`;
}

// 续写小说API - 基于已有内容继续创作
router.post('/continue', async (req, res) => {
  try {
    console.log('收到续写请求:', req.body);
    
    const { existingContent, genre = '奇幻', theme = '冒险', length = '中等' } = req.body;
    
    if (!existingContent || !existingContent.trim()) {
      throw new Error('没有需要续写的内容');
    }
    
    // 构建续写提示词
    const lengthText = {
      '短篇': '续写大约1000-2000字',
      '中等': '续写大约3000-5000字', 
      '长篇': '续写大约6000-8000字'
    };
    
    const finalPrompt = `以下是一篇${genre}类型小说${theme}主题的已有内容，请你继续往下创作：

---
${existingContent}
---

请继续往下写，要求：
- ❌ 禁止重复已有内容，直接续写新内容
- ✅ 保持原有故事的风格和人物设定
- ✅ 一个场景一个段落，每个段落1-3行，正确分段
- ✅ 延续情节发展，保持故事连贯性
- ✅ 有具体的场景描写和人物对话
- ✅ ${lengthText[length] || `续写${length}`}
- ✅ 直接输出续写内容，不需要任何说明`;
    
    // 使用智谱AI API / 火山引擎方舟
    const apiBase = process.env.ZHIPU_AI_API_BASE || 'https://open.bigmodel.cn/api/paas/v4/';
    const apiKey = process.env.ZHIPU_AI_API_KEY;
    
    if (!apiKey) {
      throw new Error('未配置ZHIPU_AI_API_KEY');
    }
    
    console.log('续写 - 使用API端点:', apiBase);
    console.log('续写 - 使用模型:', process.env.ZHIPU_AI_MODEL);
    
    // 设置响应头以支持流式输出
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 构建请求参数 (OpenAI兼容格式)
    const requestBody = {
      model: process.env.ZHIPU_AI_MODEL || 'doubao-seed-2.0-pro',
      messages: [
        {
          role: 'system',
          content: '你是一位优秀的小说作家，擅长创作各种类型的小说。请根据用户提供的已有内容，继续往下创作精彩的故事。'
        },
        {
          role: 'user',
          content: finalPrompt
        }
      ],
      max_tokens: length === '短篇' ? 2000 : length === '中等' ? 4000 : 6000,
      temperature: 0.8,
      stream: true  // 启用流式输出
    };
    
    console.log('续写请求参数构建完成');
    
    // 发送请求到API
    const normalizedApiBase = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
    const url = `${normalizedApiBase}chat/completions`;
    console.log('续写请求URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('续写API响应状态:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`续写API请求失败: ${response.status}, ${errorText}`);
      throw new Error(`API请求失败: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    // 处理流式响应
    const { body } = response;
    
    if (!body) {
      throw new Error('API响应体为空');
    }
    
    console.log('续写开始流式传输...');
    
    // 使用更兼容的方式处理流，适配 Cloudflare 环境
    return new Promise((resolve, reject) => {
      let byteCount = 0;
      let isCloudflare = typeof process !== 'undefined' && process.env && (process.env.CF_PAGES || process.env.CF_WORKER);
      
      body.on('data', (chunk) => {
        try {
          byteCount += chunk.length;
          const chunkStr = chunk.toString('utf-8');
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            // Cloudflare 不需要 Connection: keep-alive
            if (!isCloudflare) {
              res.setHeader('Connection', 'keep-alive');
            }
          }
          if (!res.writableEnded && res.write) {
            res.write(chunkStr);
          }
          console.log(`续写收到数据块: ${chunk.length} bytes, 总计: ${byteCount} bytes`);
        } catch (err) {
          console.error('续写写出数据失败:', err);
          reject(err);
        }
      });
      
      body.on('end', () => {
        try {
          console.log(`续写流式传输完成，总计: ${byteCount} bytes`);
          if (!res.writableEnded && res.write) {
            res.write('data: [DONE]\n\n');
          }
          if (!res.writableEnded && res.end) {
            res.end();
          }
          resolve();
        } catch (err) {
          console.error('续写结束流失败:', err);
          reject(err);
        }
      });
      
      body.on('error', (err) => {
        console.error('续写API流错误:', err);
        if (!res.headersSent && res.status) {
          res.status(500).json({ error: err.message });
        } else if (!res.writableEnded && res.write) {
          try {
            res.write(`data: {"error": "${err.message.replace(/"/g, '\\"')}"}\n\n`);
            res.write('data: [DONE]\n\n');
            if (res.end) {
              res.end();
            }
          } catch (e) {
            console.error('续写发送错误信息失败:', e);
          }
        }
        reject(err);
      });
    });
    
  } catch (error) {
    console.error('续写小说失败 (全局错误):', error);
    if (!res.writableEnded) {
      if (res.headersSent && res.write) {
        try {
          res.write(`data: {"error": "${error.message.replace(/"/g, '\\"')}"}\n\n`);
          res.write('data: [DONE]\n\n');
          if (res.end) {
            res.end();
          }
        } catch (e) {
          console.error('续写发送错误响应失败:', e);
        }
      } else if (res.status) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }
});

module.exports = router;

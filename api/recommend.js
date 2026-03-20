// Vercel Serverless Function - 调用Kimi AI推荐菜谱
export default async function handler(req, res) {
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ingredients } = req.body;
    
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: '请提供食材列表' });
    }

    // 构建提示词
    const prompt = `我是一个智能冰箱管家APP，用户现有以下食材：${ingredients.join('、')}。
请根据这些食材推荐3-4道可以做的菜。

要求：
1. 优先推荐能用完现有食材的菜
2. 每道菜给出：菜名、难度（简单/中等/困难）、预计用时、所需食材清单、烹饪步骤（3-5步）
3. 如果食材不够做一道完整的菜，可以推荐需要补充少量食材的菜，并注明需要补充什么

请按以下JSON格式返回（只返回JSON，不要其他文字）：
{
  "recipes": [
    {
      "name": "菜名",
      "difficulty": "简单",
      "time": "20分钟",
      "ingredients": ["食材1", "食材2"],
      "steps": ["步骤1", "步骤2", "步骤3"]
    }
  ]
}`;

    // 调用Kimi API
    // 注意：这里使用Moonshot AI (Kimi) 的API
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KIMI_API_KEY || 'sk-test'}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: '你是一个专业的厨师和营养师，擅长根据现有食材推荐美味健康的菜谱。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // 解析JSON（Kimi可能返回markdown格式的JSON）
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.match(/```json\n([\s\S]*?)\n```/)[1];
    } else if (content.includes('```')) {
      jsonStr = content.match(/```\n([\s\S]*?)\n```/)[1];
    }
    
    const recipes = JSON.parse(jsonStr);
    
    // 添加ID和匹配度计算
    const processedRecipes = recipes.recipes.map(r => ({
      ...r,
      id: Date.now() + Math.random(),
      matchRate: r.ingredients.filter(ing => 
        ingredients.some(name => name.includes(ing) || ing.includes(name))
      ).length / r.ingredients.length,
      matched: r.ingredients.filter(ing => 
        ingredients.some(name => name.includes(ing) || ing.includes(name))
      ),
      missing: r.ingredients.filter(ing => 
        !ingredients.some(name => name.includes(ing) || ing.includes(name))
      ),
      image: '🍽️'
    }));

    res.status(200).json({ recipes: processedRecipes });

  } catch (error) {
    console.error('Error:', error);
    // 如果AI调用失败，返回错误，让前端使用本地备用方案
    res.status(500).json({ 
      error: 'AI服务暂时不可用',
      message: error.message 
    });
  }
}

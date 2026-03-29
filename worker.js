export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    try {
      const bodyText = await request.text();
      const data = JSON.parse(bodyText);

      // ==================== NapCat Token 签名验证 ====================
      const token = (env.NOTIFY_TOKEN || "").trim();
      if (token) {
        const signature = request.headers.get("x-signature");
        if (!signature || !signature.startsWith("sha1=")) {
          return new Response("{}", { status: 403, headers: { "Content-Type": "application/json" } });
        }
        const expectedSig = await computeHMACSHA1(bodyText, token);
        if (signature !== `sha1=${expectedSig}`) {
          return new Response("{}", { status: 403, headers: { "Content-Type": "application/json" } });
        }
      }

      // ==================== 过滤逻辑 ====================
      if (data.post_type === "notice" && data.notice_type === "notify" && data.sub_type === "input_status") {
        return new Response("{}", { headers: { "Content-Type": "application/json" } });
      }
      if (data.post_type !== "message" && data.post_type !== "message_sent") {
        return new Response("{}", { headers: { "Content-Type": "application/json" } });
      }

      const userId = data.user_id;
      const groupId = data.group_id;
      const selfId = data.self_id;
      const allowedIds = (env.ALLOWED_IDS || "").split(",").map(id => id.trim());
      const isFromSelf = String(userId) === String(selfId);
      const isAllowedGroup = groupId && allowedIds.includes(String(groupId));
      const isAllowedUser = !groupId && allowedIds.includes(String(userId));

      if (!isFromSelf && !isAllowedGroup && !isAllowedUser) {
        return new Response("{}", { headers: { "Content-Type": "application/json" } });
      }

      // ==================== 消息内容解析 ====================
      const sender = data.sender?.nickname || data.sender?.user_id || "未知用户";
      const source = groupId ? `群:${groupId}` : "私聊";
      let textContent = "";
      let imageUrls = [];

      if (Array.isArray(data.message)) {
        data.message.forEach(item => {
          if (item.type === "text" && item.data?.text) textContent += item.data.text;
          if (item.type === "image" && item.data?.url) imageUrls.push(item.data.url);
        });
      }

      const reportFull = `【QQ转发】\n来自：${sender} (${source})\n内容：${textContent.trim() || "[无文字内容]"}`;

      // ==================== 并发推送任务 ====================
      const tasks = [];

      // 企业微信任务
      if (env.WECHAT_ROBOT_KEY) {
        let wechatContent = reportFull;
        if (imageUrls.length > 0) {
          wechatContent += `\n\n查看图片：`;
          imageUrls.forEach((url, i) => {
            wechatContent += `\n<a href="${url}">点击查看图片 ${i + 1}</a>`;
          });
        }
        tasks.push(fetch(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${env.WECHAT_ROBOT_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msgtype: "text", text: { content: wechatContent } })
        }));
      }

      // Telegram 任务
      if (env.TG_BOT_TOKEN && env.TG_CHAT_ID) {
        const tgBaseUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}`;
        if (imageUrls.length > 0) {
          const media = imageUrls.slice(0, 10).map((url, index) => ({
            type: "photo",
            media: url,
            caption: index === 0 ? reportFull : "",
            parse_mode: "HTML"
          }));
          tasks.push(fetch(`${tgBaseUrl}/sendMediaGroup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: env.TG_CHAT_ID, media: media })
          }));
        } else {
          tasks.push(fetch(`${tgBaseUrl}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: reportFull, parse_mode: "HTML" })
          }));
        }
      }

      // 并行执行所有推送任务，互不阻塞
      await Promise.allSettled(tasks);

      return new Response("{}", { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
};

async function computeHMACSHA1(data, key) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}

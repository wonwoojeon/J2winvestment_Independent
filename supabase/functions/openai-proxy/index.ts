import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const { messages, model = "gpt-4o-mini", temperature = 0.3, max_tokens = 400 } = body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const trimmedMessages = messages.slice(-20); // 기본 방어: 최근 20개만 전달

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: trimmedMessages,
        temperature,
        max_tokens
      })
    });

    const openAiData = await openAiRes.json();

    if (!openAiRes.ok) {
      return new Response(JSON.stringify({ error: openAiData }), {
        status: openAiRes.status,
        headers: corsHeaders
      });
    }

    return new Response(
      JSON.stringify({
        model: openAiData.model,
        usage: openAiData.usage,
        choices: openAiData.choices
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("openai-proxy error", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: corsHeaders
    });
  }
});


const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found in .env.local");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const modelResponse = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get client, actually wait, Manager is different.

        // Actually the SDK has no direct listModels on the genAI instance in some versions?
        // Let's check documentation or use the model manager if accessible.
        // Wait, the standard way in v0.24 is via GoogleGenerativeAI instance? No, it's usually separate.
        // Let's try to query a known model and print it, or try a fetch if SDK missing it.

        // Actually, checking documentation is better.
        // But let's try a simple fetch to the API endpoint which is foolproof.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No models found or error structure:", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();

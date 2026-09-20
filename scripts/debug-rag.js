require("dotenv").config({
    path: "./bot/.env"
})
const { answerQuestion } = require("../server/lib/rag")
const useAi = process.argv.includes("--ai") 

const question = process.argv
    .slice(2)
    .filter(argument => argument !== "--ai")
    .join(" ")
    .trim()

if (!question) {
    console.error('Usage: npm run rag -- [--ai] "your repository question"')
    process.exit(1)
}


answerQuestion({
    question,
    onActivity: activity => process.stderr.write(`${JSON.stringify(activity)}\n`),
    onToken: token => process.stdout.write(token)
}, useAi)
    .then(result => {
        process.stdout.write("\n")
        process.stderr.write(`${JSON.stringify({
            sources: result.sources?.length || 0,
            activities: result.activities?.length || 0,
            answerLength: result.answer?.length || 0
        }, null, 2)}\n`)
    })
    .catch(error => {
        console.error(error.message)
        process.exitCode = 1
    })

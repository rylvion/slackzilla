const fs = require("fs")
const path = require("path")

const filePath = path.join(__dirname, "..", "src", "data", "commands.json")

const commands = JSON.parse(fs.readFileSync(filePath, "utf8"))

const list = Object.entries(commands).filter(([key]) => key !== "$schema")

console.log("Commands:")
list.forEach(([name, data]) => {
    console.log(`- ${name}: ${data.description}`)
});

console.log(`\nTotal: ${list.length}`)

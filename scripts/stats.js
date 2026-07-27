const fs = require("fs")
const path = require("path")

const filePath = path.join(__dirname, "..", "src", "data", "commands.json")
const commands = JSON.parse(fs.readFileSync(filePath, "utf8"))

const list = Object.entries(commands).filter(([key]) => key !== "$schema")

const categoryCounts = list.reduce((acc, [name, data]) => {
    const category = data.category || "other"
    acc[category] = (acc[category] || 0) + 1
    return acc
}, {})

const total = list.length

const divider = "-"
const col1 = 25
const col2 = 10
const col3 = 10

const getTotal = () => total
const getCategoryCounts = () => categoryCounts
const getTotalCategoryCount = () => Object.keys(categoryCounts).length

const getDict = () => {
    const dict = {}

    list.forEach(([name, data]) => {
        const category = data.category || "other"
        dict[name] = category
    })

    return dict
}

function buildStats() {
    let output = ""

    output += divider.repeat(50) + "\n"
    output += "Category".padEnd(col1) +
              "Count".padEnd(col2) +
              "Percent".padEnd(col3) + "\n"
    output += divider.repeat(50) + "\n"

    Object.entries(categoryCounts).forEach(([category, count]) => {
        const percent = ((count / total) * 100).toFixed(1) + "%"
        output += (category.charAt(0).toUpperCase() + category.slice(1)).padEnd(col1) +
                  String(count).padEnd(col2) +
                  percent.padEnd(col3) + "\n"
    })

    output += divider.repeat(50) + "\n"
    output += "Total".padEnd(col1) +
              String(total).padEnd(col2) +
              "100%".padEnd(col3) + "\n"
    output += divider.repeat(50)

    return output
}

if (require.main === module) {
    console.log(buildStats())
}

module.exports = {
    buildStats,
    getTotal,
    getTotalCategoryCount,
    getCategoryCounts,
    getDict 
}

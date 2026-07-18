# Devlog 4: calc and roll commands
time logged: 2 hr 15 minutes
date: 17/07/2026

today i spent some time reading the [Java Shunting Yard Algorithm implementation on GeeksforGeeks](https://www.geeksforgeeks.org/java/java-program-to-implement-shunting-yard-algorithm/). The example focuses entirely on converting an infix expression into postfix form. It scans the expression character by character, places operands directly into the output string, and uses a stack to manage operators based on precedence and associativity. Once the scan is complete, any remaining operators are appended to produce a postfix expression like 5238-52^^/+. The Java version supports operators including `+`, `-`, `*`, `/`, and `^`, and it handles parentheses, but it stops after producing the postfix representation. It does not evaluate the numerical result. 

after reading that, i wanted something more complete for Slackzilla. I used the same core idea of converting infix to postfix, but I extended it in several ways. My implementation tokenises the input instead of reading one character at a time, which allows it to support multi digit numbers and decimals. I added unary minus detection so expressions like `-3` or `5*-2` behave correctly. One challenge was distinguishing unary minus from subtraction. The parser has to determine whether it starts with a number or subtracts two values depending on the previous token. I kept exponentiation with the correct right associativity. Once the postfix array is built, I added a second stage that evaluates the postfix expression using a number stack. This lets the function return the final computed value rather than just the postfix notation. The result is a more flexible and practical version of the algorithm that fits naturally into Slackzilla and can evaluate real expressions interactively.

after finishing the calculator command, I also added another command to Slackzilla called `/sz-roll`. This command allows users to simulate dice rolls directly inside Slack. It supports normal dice notation like `d6`, custom dice sizes like `d20`, multiple dice such as `2d6`, and modifiers like `2d20+5`. I added parsing logic to split the dice expression into the amount of dice, number of sides, and any modifier before rolling each dice individually and calculating the final total.

I also added a `/sz-roll help` and `/sz-calc help` command which explains how to use the command and shows examples of supported formats. 

also i spent A LOT of time making the flowchart to describe this more than the implementation itself. I think it will be useful for future reference and for anyone else who wants to understand how the algorithm works.

i also added json schema validation for `commands.json` as talked in devlog 2 the `commands.json` is the source of truth, so i addded a `validator.yml` to validate the json schema of `commands.json` and make sure it is valid before a pull request is merged. This will help prevent errors and ensure that the commands are correctly defined.

TL;DR: added a calculator using the Shunting Yard algorithm with postfix evaluation, plus a flexible dice rolling command. Also added help commands, flowcharts and automated JSON schema validation.

also ill add way more devlogs from now on since most of my last devlogs were major architecture refactor, unless there is a major change, i will just add a small devlog to add a new command/small feature, fix a bug, improve an existing feature and add more documentation. 

---

<a href="devlog3.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
    <img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" aria-label="Visit Devlog 3" />
  </picture>
</a>

<p align="right">
  <em>
    <b>
      <a href="">
        visit devlog 5
      </a>
    </b>
  </em>
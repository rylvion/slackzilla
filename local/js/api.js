document.querySelectorAll('[data-endpoint]').forEach(el => {
  el.style.cursor = 'pointer';

  el.addEventListener('click', () => {
    const url = el.getAttribute('data-endpoint');

    navigator.clipboard.writeText(url).then(() => {
      el.classList.add('copied');

      setTimeout(() => {
        el.classList.remove('copied');
      }, 800);
    });
  });
});


document.querySelectorAll("pre").forEach((pre) => {
    const button = document.createElement("button")

    button.className = "copy-code"
    button.textContent = "Copy"

    pre.appendChild(button)

    button.addEventListener("click", async (event) => {
        event.stopPropagation()

        const code = pre.querySelector("code").innerText

        await navigator.clipboard.writeText(code)

        button.textContent = "Copied!"

        setTimeout(() => {
            button.textContent = "Copy"
        }, 1500)
    })
})

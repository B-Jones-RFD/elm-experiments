// Small progressive-enhancement hooks. The app works without this file.
document.documentElement.classList.add('js')
// Remove toasts after their exit animation so the region does not fill up.
document.addEventListener('animationend', (e) => {
  if (e.animationName === 'toast-out' && e.target.classList.contains('toast')) e.target.remove()
})

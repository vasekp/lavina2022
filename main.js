window.addEventListener('DOMContentLoaded', () => {
  const chkbox = document.getElementById('nav-unfold');
  document.querySelector('nav').addEventListener('click', () => {
    chkbox.checked = !chkbox.checked;
  });
});

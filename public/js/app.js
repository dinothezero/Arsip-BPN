document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('-translate-x-full');
    });
  }

  const flashMsg = document.getElementById('flashMessage');
  if (flashMsg) {
    setTimeout(() => flashMsg.classList.add('hidden'), 4000);
  }
});

function toggleUserEdit(id) {
  const panel = document.getElementById('user-edit-' + id);
  if (panel) {
    panel.classList.toggle('hidden');
  }
}
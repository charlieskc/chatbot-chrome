document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('bearer-token');
  const saveButton = document.getElementById('save-token');

  // Load existing token
  chrome.storage.local.get(['bearerToken'], (result) => {
    if (result.bearerToken) {
      tokenInput.value = result.bearerToken;
    }
  });

  // Save token
  saveButton.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    chrome.storage.local.set({ bearerToken: token }, () => {
      alert('Token saved successfully!');
    });
  });
});
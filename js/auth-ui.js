// Auth UI: injects a global login modal and controls the top-login button + admin link visibility
(function(){
  const ADMIN_NAV_ID = 'adminNavLink';
  const LOGIN_BTN_ID = 'loginTopBtn';
  const MODAL_ID = 'globalLoginModal';

  function createModal(){
    if (document.getElementById(MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(0,0,0,0.4)';
    modal.style.zIndex = '9999';

    const box = document.createElement('div');
    box.style.width = '360px';
    box.style.background = '#fff';
    box.style.borderRadius = '10px';
    box.style.padding = '18px';
    box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.12)';

    box.innerHTML = `
      <h3 style="margin-top:0;margin-bottom:8px">Iniciar sesión</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        <input id="globalAdmEmail" type="email" placeholder="Email" style="padding:10px;border:1px solid #e6e9ee;border-radius:8px;width:100%" />
        <input id="globalAdmPass" type="password" placeholder="Contraseña" style="padding:10px;border:1px solid #e6e9ee;border-radius:8px;width:100%" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button id="globalCancel" class="btn btn-secondary">Cancelar</button>
          <button id="globalLoginBtn" class="btn btn-primary">Ingresar</button>
        </div>
        <div id="globalLoginMsg" style="margin-top:8px"></div>
      </div>
    `;

    modal.appendChild(box);
    document.body.appendChild(modal);

    // handlers
    document.getElementById('globalCancel').addEventListener('click', () => closeModal());
    document.getElementById('globalLoginBtn').addEventListener('click', async () => {
      const em = document.getElementById('globalAdmEmail').value.trim();
      const pw = document.getElementById('globalAdmPass').value || '';
      const msg = document.getElementById('globalLoginMsg');
      msg.textContent = '';
      document.getElementById('globalLoginBtn').disabled = true;
      try {
        await window.authSignIn(em, pw);
        updateAuthUI();
        closeModal();
      } catch (err) {
        msg.textContent = 'Error: ' + (err && err.message ? err.message : err);
        msg.style.color = '#b91c1c';
      } finally {
        document.getElementById('globalLoginBtn').disabled = false;
      }
    });
  }

  function openModal(){
    if (!document.getElementById(MODAL_ID)) createModal();
    const m = document.getElementById(MODAL_ID);
    if (m) m.style.display = 'flex';
  }
  function closeModal(){
    const m = document.getElementById(MODAL_ID);
    if (m) m.style.display = 'none';
  }

  function updateAuthUI(){
    const btn = document.getElementById(LOGIN_BTN_ID);
    const adminLink = document.getElementById(ADMIN_NAV_ID);
    const user = window.getCurrentUser && window.getCurrentUser();
    if (user) {
      if (btn) btn.textContent = 'Logout';
      if (adminLink) adminLink.style.display = '';
    } else {
      if (btn) btn.textContent = 'Login';
      if (adminLink) adminLink.style.display = 'none';
    }
  }

  function attach(){
    document.addEventListener('click', (e) => {
      // close modal when clicking outside box
      const m = document.getElementById(MODAL_ID);
      if (!m) return;
      if (e.target === m) closeModal();
    });

    const btn = document.getElementById(LOGIN_BTN_ID);
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = window.getCurrentUser && window.getCurrentUser();
        if (user) {
          // logout
          await window.authSignOut();
          updateAuthUI();
        } else {
          // open modal
          openModal();
        }
      });
    }

    // initial state
    updateAuthUI();
  }

  // expose for other scripts
  window.openGlobalLoginModal = openModal;
  window.updateAuthUI = updateAuthUI;

  // attach on DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
})();

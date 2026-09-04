const express = require('express');
const { verifyLogin } = require('../services/auth');
const { renderPage } = require('../views/layout');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/pos');

  const error = req.query.error ? '<div class="msg error">اسم المستخدم أو كلمة السر غلط</div>' : '';
  res.send(
    renderPage({
      title: 'تسجيل الدخول',
      user: null,
      body: `
        <div style="max-width:360px; margin:60px auto;">
          <h1 style="text-align:center;">تسجيل الدخول</h1>
          ${error}
          <form method="POST" action="/login" class="card">
            <label>اسم المستخدم</label>
            <input name="username" required autofocus />
            <label>كلمة السر</label>
            <input name="password" type="password" required />
            <button type="submit">دخول</button>
          </form>
        </div>
      `,
    })
  );
});

router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  const user = verifyLogin(username, password);
  if (!user) return res.redirect('/login?error=1');

  req.session.user = user;
  res.redirect(user.role === 'admin' ? '/admin' : '/pos');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;

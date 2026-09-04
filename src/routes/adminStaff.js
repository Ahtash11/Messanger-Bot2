const express = require('express');
const auth = require('../services/auth');
const { renderPage } = require('../views/layout');

const router = express.Router();

function redirectWithMsg(res, msg, ok) {
  res.redirect(`/admin/staff?msg=${encodeURIComponent(msg)}&ok=${ok ? '1' : '0'}`);
}

router.get('/', (req, res) => {
  const users = auth.listUsers();
  const rows = users
    .map(
      (u) => `<tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.role === 'admin' ? 'مدير' : 'موظف'}</td>
        <td>${u.active ? 'فعال' : 'موقوف'}</td>
        <td class="actions">
          <form method="POST" action="/admin/staff/${u.id}/toggle-active">
            <button type="submit" class="${u.active ? 'danger' : ''}">${u.active ? 'إيقاف' : 'تفعيل'}</button>
          </form>
          <form method="POST" action="/admin/staff/${u.id}/reset-password" onsubmit="return confirmPasswordReset(this);">
            <input type="hidden" name="newPassword" />
            <button type="submit" class="secondary">تغيير كلمة السر</button>
          </form>
        </td>
      </tr>`
    )
    .join('');

  const msg = req.query.msg ? `<div class="msg ${req.query.ok === '1' ? 'success' : 'error'}">${req.query.msg}</div>` : '';

  res.send(
    renderPage({
      title: 'الموظفين',
      user: req.session.user,
      activePath: '/admin/staff',
      body: `
        <h1>الموظفين</h1>
        ${msg}
        <table>
          <tr><th>اسم المستخدم</th><th>الاسم</th><th>الصلاحية</th><th>الحالة</th><th>إجراءات</th></tr>
          ${rows}
        </table>

        <h1>إضافة حساب جديد</h1>
        <form method="POST" action="/admin/staff" class="card">
          <label>اسم المستخدم (بالإنجليزي، بدون فراغات)</label>
          <input name="username" required pattern="[a-zA-Z0-9_\\.\\-]+" />

          <label>الاسم الظاهر</label>
          <input name="name" required />

          <label>كلمة السر</label>
          <input name="password" type="password" required minlength="6" />

          <label>الصلاحية</label>
          <select name="role">
            <option value="employee">موظف</option>
            <option value="admin">مدير</option>
          </select>

          <button type="submit">إضافة</button>
        </form>

        <script>
          function confirmPasswordReset(form) {
            var pw = prompt('كلمة السر الجديدة (6 أحرف على الأقل):');
            if (!pw || pw.length < 6) return false;
            form.querySelector('input[name=newPassword]').value = pw;
            return true;
          }
        <\/script>
      `,
    })
  );
});

router.post('/', express.urlencoded({ extended: true }), (req, res) => {
  const { username, name, password, role } = req.body;
  if (!username || !name || !password || password.length < 6) {
    return redirectWithMsg(res, 'تأكد إنك عبيت كل الحقول وكلمة السر 6 أحرف على الأقل', false);
  }

  const result = auth.createUser({
    username,
    name,
    password,
    role: role === 'admin' ? 'admin' : 'employee',
  });
  redirectWithMsg(res, result.success ? 'تمت إضافة الحساب' : result.reason || 'صار خطأ', result.success);
});

router.post('/:id/toggle-active', (req, res) => {
  const users = auth.listUsers();
  const target = users.find((u) => String(u.id) === req.params.id);
  if (!target) return redirectWithMsg(res, 'ما لقيتش هذا الحساب', false);

  auth.setUserActive(target.id, !target.active);
  redirectWithMsg(res, target.active ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب', true);
});

router.post('/:id/reset-password', express.urlencoded({ extended: true }), (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return redirectWithMsg(res, 'كلمة السر لازم تكون 6 أحرف على الأقل', false);
  }
  auth.resetPassword(req.params.id, newPassword);
  redirectWithMsg(res, 'تم تغيير كلمة السر', true);
});

module.exports = router;

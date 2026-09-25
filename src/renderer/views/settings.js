// Settings: Claude Code location, pacing, notifications, default style.
import { $, esc, toast } from '../util.js';

export function mount(root, app) {
  const s = app.state.settings;
  root.innerHTML = `
    <div class="page" style="max-width:760px">
      <div class="page-head"><div><div class="eyebrow">Harness</div><h1>Settings</h1></div></div>
      <form class="card section" autocomplete="off">
        <label class="field"><span>Claude Code executable</span>
          <input type="text" name="claudePath" class="mono" value="${esc(s.claudePath)}" placeholder="Found automatically. Set a path only if detection fails.">
          <small>${app.state.claudeFound ? '<span class="dot ok"></span> Claude Code found. Officials use your normal Claude Code login and subscription.' : '<span class="dot bad"></span> Claude Code not found. Install it or enter the path to claude.exe.'}</small></label>
        <div class="grid-2">
          <label class="field"><span>Sessions at once</span><input type="number" name="maxConcurrent" min="1" max="8" value="${esc(s.maxConcurrent)}">
            <small>Officials never run two sessions at once, but different officials can.</small></label>
          <label class="field"><span>Session timeout (minutes)</span><input type="number" name="jobTimeoutMin" min="5" max="240" value="${esc(s.jobTimeoutMin)}">
            <small>A session running longer than this is stopped.</small></label>
        </div>
        <label class="field"><span>Default briefing style</span><select name="defaultStyle">${app.styles
          .map((st) => `<option value="${esc(st.id)}" ${st.id === s.defaultStyle ? 'selected' : ''}>${esc(st.name)}</option>`)
          .join('')}</select></label>
        <label class="check"><input type="checkbox" name="notifications" ${s.notifications ? 'checked' : ''}><span>Windows notifications for new briefings and failures</span></label>
        <div class="muted" style="font-size:12.5px;line-height:1.5">Closing the window keeps Leader Harness running in the system tray, so officials keep working. To stop it completely, use Quit in the tray menu.</div>
        <div class="row" style="justify-content:flex-end"><button class="btn primary">Save settings</button></div>
      </form>
    </div>`;
  $('form', root).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    await app.call('settings:update', {
      claudePath: f.claudePath.value.trim(),
      maxConcurrent: Math.max(1, Number(f.maxConcurrent.value) || 1),
      jobTimeoutMin: Math.max(5, Number(f.jobTimeoutMin.value) || 30),
      defaultStyle: f.defaultStyle.value,
      notifications: f.notifications.checked,
    });
    toast('Settings saved.');
  };
  return {};
}

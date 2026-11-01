/* Thin wrapper around fetch: adds the login token and turns server errors into readable messages. */
const Api = {
  // "Remember me" keeps the token in localStorage (survives closing the browser); otherwise sessionStorage (cleared on close).
  token: localStorage.getItem("zs_token") || sessionStorage.getItem("zs_token") || "",
  setToken(t, remember = false) {
    this.token = t || "";
    localStorage.removeItem("zs_token"); sessionStorage.removeItem("zs_token");
    if (t) (remember ? localStorage : sessionStorage).setItem("zs_token", t);
  },

  async call(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: "Bearer " + this.token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const d = data.detail;
      let msg = "Something went wrong. Try again.";
      let action = null;
      let actionUser = null;

      if (typeof d === "string") {
        msg = d;
      } else if (d && typeof d.message === "string") {
        msg = d.message;
        action = d.action || null;
        actionUser = d.username || null;
      } else if (Array.isArray(d)) {
        msg = d.map(item => {
          const field = item.loc ? item.loc[item.loc.length - 1] : "Field";
          const fName = field.charAt(0).toUpperCase() + field.slice(1);
          if (item.type === "string_too_short") {
            const min = item.ctx?.min_length || 3;
            return `${fName} must be at least ${min} characters long`;
          }
          if (item.type === "string_pattern_mismatch") {
            return "Username can only contain letters, numbers, dots, hyphens, and underscores";
          }
          return item.msg ? `${fName}: ${item.msg}` : "Invalid field value";
        }).join(". ");
      }

      const err = new Error(msg);
      err.status = res.status;
      err.action = action;
      err.actionUser = actionUser;
      err.problems = d && d.problems;
      throw err;
    }
    return data;
  },
  get: (p) => Api.call("GET", p),
  post: (p, b) => Api.call("POST", p, b === undefined ? {} : b),
  put: (p, b) => Api.call("PUT", p, b),
};

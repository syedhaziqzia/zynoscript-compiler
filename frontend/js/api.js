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
      const err = new Error(typeof d === "string" ? d : (d && d.message) || "Something went wrong. Try again.");
      err.status = res.status;
      err.problems = d && d.problems;
      if (Array.isArray(d)) err.message = "Check the highlighted fields: " + d.map(x => x.loc.slice(-1)[0] + " " + x.msg).join("; ");
      throw err;
    }
    return data;
  },
  get: (p) => Api.call("GET", p),
  post: (p, b) => Api.call("POST", p, b === undefined ? {} : b),
  put: (p, b) => Api.call("PUT", p, b),
};

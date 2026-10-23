/**
 * PM2 for one VM: the panel, the website, and nothing else.
 *
 * There is no nginx in front. TLS and the public hostname are somebody else's
 * job — a Cloudflare tunnel, a load balancer, whatever sits upstream — so both
 * apps bind to loopback by default and are not reachable from outside the box
 * on their own. Set `LOTUSPEAK_BIND=0.0.0.0` if the thing forwarding to them
 * is on another machine, and understand that the panel is then on the internet
 * on port 6011 with only its own sign-in between it and the world.
 *
 * Start from the repo root, where `apps/` and `node_modules/` are:
 *
 *     pm2 start deploy/ecosystem.config.js
 *     pm2 save && pm2 startup        # survive a reboot
 *
 * `npm run build` must have run first, admin before web — see deploy/README.md,
 * which explains why that order is not a preference.
 */

const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

/**
 * Next's own launcher, not `npm run start`.
 *
 * PM2 would otherwise supervise npm, which supervises next: a restart then
 * kills the wrapper and `pm2 stop` can leave the real server holding the port,
 * which looks exactly like a port conflict and is not one. This runs the
 * server directly, so the process PM2 is watching is the process serving.
 */
const NEXT = path.join(ROOT, "node_modules/next/dist/bin/next");

/** Loopback unless told otherwise. See the note at the top. */
const BIND = process.env.LOTUSPEAK_BIND || "127.0.0.1";

function app(name, dir, port) {
    return {
        name,
        script: NEXT,
        args: ["start", "--port", String(port), "--hostname", BIND],
        cwd: path.join(ROOT, dir),
        interpreter: "node",

        /**
         * One process, fork mode — not `cluster`, and not `instances: max`.
         *
         * Both apps keep things in memory that are only correct if there is one of
         * them. The website's rendered pages and the tags they were cached under
         * live in that process, so a publish POSTed to `/api/revalidate` clears the
         * worker that happened to answer it and leaves the others serving the old
         * page: the office would correct a price, see it change on reload, refresh
         * again and watch it change back. The enquiry rate limit and the mail
         * allowance count the same way. Scaling this site means another box and a
         * shared cache, not another worker.
         */
        exec_mode: "fork",
        instances: 1,

        autorestart: true,
        /* A crash loop should stop and stay stopped rather than restart for ever
       while the logs scroll past: a bad .env fails the same way every time. */
        max_restarts: 10,
        min_uptime: "20s",
        restart_delay: 2000,

        /** Long enough for an in-flight render to finish before SIGKILL. */
        kill_timeout: 10000,
        listen_timeout: 20000,

        /* Not a limit, a tripwire. Steady state is well under this; reaching it
       means a leak, and a restart is better than the OOM killer choosing. */
        max_memory_restart: "768M",

        env: {
            NODE_ENV: "production",
            /* Next reads PORT and HOSTNAME as well as the flags above. Both are set
         so that neither a flag nor an inherited variable can win quietly. */
            PORT: String(port),
            HOSTNAME: BIND,
        },

        out_file: path.join(ROOT, "deploy/logs", `${name}.out.log`),
        error_file: path.join(ROOT, "deploy/logs", `${name}.err.log`),
        merge_logs: true,
        time: true,
    };
}

module.exports = {
    /**
     * The panel first — but PM2 launches both at once, so this is reading order
     * and not a guarantee.
     *
     * It cannot be one: the website can win the race and answer a request or two
     * against a panel that is not listening yet. Those requests fall back to the
     * hourly cache or 500, which is survivable on a restart and not survivable
     * during a release, where the website must compile against *this* release's
     * API. That is why `deploy/deploy.sh` starts them one at a time with
     * `--only` and waits for `/api/health` in between, and why a plain
     * `pm2 start` of this file is for a reboot rather than a deploy.
     */
    apps: [
        app("lotuspeak-admin", "apps/admin", 6001),
        app("lotuspeak-web", "apps/web", 3000),
    ],
};

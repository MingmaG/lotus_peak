/**
 * The storage key for closed notices, and the script that reads it before paint.
 *
 * Its own module, without `'use client'`, because the root layout — a server
 * component — prints the script into `<head>`. A string exported from a client
 * module reaches a server component as a client reference, not as the string.
 */
export const CLOSED_NOTICES_KEY = 'lp-notices-closed'

/**
 * Runs in `<head>`, before the first paint, and hides what this visitor closed.
 *
 * Without it a returning visitor would see a bar they closed yesterday flash
 * across the top of the page and vanish when React reads storage — a layout
 * shift on every page they open. Each announcement in the server's HTML
 * carries `data-notice="id:version"`; this writes a rule hiding each closed
 * one, and one more hiding the whole bar when it holds nothing that is not
 * closed (`:has`, so the rule needs no knowledge of which announcements the
 * page happens to hold).
 */
export const HIDE_CLOSED_NOTICES = `try{var c=JSON.parse(localStorage.getItem('${CLOSED_NOTICES_KEY}')||'{}'),r='',n='';for(var k in c){var s='[data-notice="'+String(k).replace(/[^\\w-]/g,'')+':'+String(c[k]).replace(/[^\\w-]/g,'')+'"]';r+='.lp-notice-slide'+s+'{display:none!important}';n+=':not('+s+')'}if(r){r+='.lp-notice-bar:not(:has(.lp-notice-slide'+n+')){display:none!important}';var e=document.createElement('style');e.textContent=r;document.head.appendChild(e)}}catch(e){}`

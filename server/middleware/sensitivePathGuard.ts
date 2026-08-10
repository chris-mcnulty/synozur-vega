/**
 * Sensitive-path guard (pen-test finding #1)
 *
 * The SPA catch-all returns HTTP 200 for every unmatched path, which causes
 * scanners to flag /.env (and similar paths) as a critical exposure even when
 * no real file exists. Return 404 for these paths before any other handler.
 *
 * Covered probe paths (extend this list as new scanner findings arise):
 *   Dot-files / VCS   : /.env, /.env.*, /.git/*, /.gitignore, /.htaccess,
 *                       /.DS_Store, /.svn/*
 *   CMS / PHP configs : /wp-config.php, /config.php, /configuration.php,
 *                       /wp-login.php, /wp-admin/*, /xmlrpc.php,
 *                       /administrator/*, /admin.php
 *   Server internals  : /server-status, /server-info
 *   Common backups    : /backup/*, /db.sql, /dump.sql
 */

import type { Request, Response, NextFunction } from "express";

export const SENSITIVE_PATH_RE = [
  /^\/(\.env(\..*)?)$/,
  /^\/\.git(\/|$)/,
  /^\/(\.gitignore|\.htaccess|\.DS_Store)$/,
  /^\/\.svn(\/|$)/,
  /^\/(wp-config\.php|config\.php|configuration\.php|admin\.php|xmlrpc\.php|wp-login\.php)$/i,
  /^\/(wp-admin|administrator)(\/|$)/i,
  /^\/(server-status|server-info)$/i,
  /^\/backup(\/|$)/i,
  /^\/(db|dump)\.sql$/i,
];

export function sensitivePathGuard(req: Request, res: Response, next: NextFunction): void {
  if (SENSITIVE_PATH_RE.some((re) => re.test(req.path))) {
    res.status(404).end();
    return;
  }
  next();
}

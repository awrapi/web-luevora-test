<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sitemap">

  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>XML Sitemap | Luevora</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
        <style>
          :root {
            --bg-body: #090d16;
            --bg-card: #0f172a;
            --bg-card-hover: #17223b;
            --border-subtle: #1e293b;
            --border-glow: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
            --accent-indigo: #6366f1;
            --accent-indigo-light: #818cf8;
            --accent-indigo-glow: rgba(99, 102, 241, 0.15);
            --accent-emerald: #10b981;
            --accent-emerald-bg: rgba(16, 185, 129, 0.12);
            --accent-amber: #f59e0b;
            --accent-amber-bg: rgba(245, 158, 11, 0.12);
            --accent-sky: #0284c7;
            --accent-sky-bg: rgba(2, 132, 199, 0.12);
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            background-color: var(--bg-body);
            color: var(--text-main);
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            padding: 40px 20px 60px;
            line-height: 1.5;
            background-image: 
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.2), transparent 70%),
              radial-gradient(circle at 90% 20%, rgba(16, 185, 129, 0.05), transparent 40%);
          }

          .container {
            max-width: 1100px;
            margin: 0 auto;
          }

          /* Header */
          .header {
            margin-bottom: 32px;
          }

          .brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 20px;
          }

          .brand-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
          }

          .brand-logo-icon {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: linear-gradient(135deg, #6366f1, #4338ca);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.35);
          }

          .brand-logo-icon svg {
            width: 22px;
            height: 22px;
            fill: #ffffff;
          }

          .brand-name {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #ffffff;
          }

          .brand-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 9999px;
            background: var(--accent-indigo-glow);
            color: var(--accent-indigo-light);
            border: 1px solid rgba(99, 102, 241, 0.3);
          }

          .btn-home {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            color: #ffffff;
            background-color: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            text-decoration: none;
            transition: all 0.2s ease;
          }

          .btn-home:hover {
            background-color: var(--bg-card-hover);
            border-color: var(--accent-indigo);
            transform: translateY(-1px);
          }

          .title-area h1 {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.025em;
            margin-bottom: 8px;
            background: linear-gradient(to right, #ffffff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .title-area p {
            color: var(--text-muted);
            font-size: 14px;
            max-width: 700px;
          }

          /* Stats bar */
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
          }

          .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .stat-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .stat-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-main);
          }

          .stat-tag {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: var(--accent-emerald);
          }

          /* Table Card */
          .table-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
          }

          .table-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--border-subtle);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(15, 23, 42, 0.6);
          }

          .table-header-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-main);
          }

          .table-responsive {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 13px;
          }

          th {
            background: rgba(15, 23, 42, 0.9);
            color: var(--text-muted);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 14px 20px;
            border-bottom: 1px solid var(--border-subtle);
            white-space: nowrap;
          }

          td {
            padding: 14px 20px;
            border-bottom: 1px solid rgba(30, 41, 59, 0.6);
            color: var(--text-main);
            vertical-align: middle;
          }

          tr:last-child td {
            border-bottom: none;
          }

          tr:hover td {
            background-color: var(--bg-card-hover);
          }

          .url-link {
            color: #60a5fa;
            text-decoration: none;
            font-weight: 500;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12.5px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: color 0.15s ease;
          }

          .url-link:hover {
            color: #93c5fd;
            text-decoration: underline;
          }

          .priority-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
          }

          .priority-high {
            background: var(--accent-emerald-bg);
            color: var(--accent-emerald);
            border: 1px solid rgba(16, 185, 129, 0.25);
          }

          .priority-med {
            background: var(--accent-indigo-glow);
            color: var(--accent-indigo-light);
            border: 1px solid rgba(99, 102, 241, 0.25);
          }

          .priority-low {
            background: rgba(148, 163, 184, 0.1);
            color: var(--text-muted);
            border: 1px solid rgba(148, 163, 184, 0.2);
          }

          .badge-freq {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            text-transform: capitalize;
            background: rgba(30, 41, 59, 0.8);
            color: var(--text-muted);
            border: 1px solid var(--border-subtle);
          }

          .date-text {
            color: var(--text-dim);
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
          }

          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: var(--text-dim);
          }

          .footer a {
            color: var(--text-muted);
            text-decoration: none;
          }

          .footer a:hover {
            color: var(--accent-indigo-light);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <header class="header">
            <div class="brand-row">
              <a href="https://luevora.com" class="brand-logo">
                <div class="brand-logo-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span class="brand-name">Luevora</span>
                <span class="brand-badge">Sitemap</span>
              </a>

              <a href="https://luevora.com" class="btn-home">
                <span>Back to Luevora</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>

            <div class="title-area">
              <h1>XML Sitemap</h1>
              <p>This sitemap is indexed by search engines like Google and Bing to crawl and discover public pages on Luevora.</p>
            </div>
          </header>

          <!-- Stat Overview -->
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-label">Total Indexed URLs</span>
              <span class="stat-value">
                <xsl:value-of select="count(sitemap:urlset/sitemap:url | urlset/url | *[local-name()='urlset']/*[local-name()='url'])"/>
              </span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Protocol</span>
              <span class="stat-value">Sitemaps 0.9</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Status</span>
              <span class="stat-value">
                <span class="stat-tag">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                  Live &amp; Valid
                </span>
              </span>
            </div>
          </div>

          <!-- Main Table -->
          <div class="table-card">
            <div class="table-header">
              <span class="table-header-title">Public URL Directory</span>
            </div>
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th style="width: 50px;">#</th>
                    <th>URL / Location</th>
                    <th style="width: 110px;">Priority</th>
                    <th style="width: 140px;">Change Freq</th>
                    <th style="width: 140px;">Last Modified</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="sitemap:urlset/sitemap:url | urlset/url | *[local-name()='urlset']/*[local-name()='url']">
                    <tr>
                      <td style="color: var(--text-dim); font-family: 'JetBrains Mono', monospace; font-size: 11px;">
                        <xsl:value-of select="position()"/>
                      </td>
                      <td>
                        <xsl:variable name="itemURL">
                          <xsl:value-of select="sitemap:loc | loc | *[local-name()='loc']"/>
                        </xsl:variable>
                        <a href="{$itemURL}" class="url-link" target="_blank" rel="noopener noreferrer">
                          <xsl:value-of select="$itemURL"/>
                        </a>
                      </td>
                      <td>
                        <xsl:variable name="priorityVal">
                          <xsl:value-of select="sitemap:priority | priority | *[local-name()='priority']"/>
                        </xsl:variable>
                        <xsl:choose>
                          <xsl:when test="$priorityVal &gt;= 0.8">
                            <span class="priority-pill priority-high">
                              <xsl:value-of select="$priorityVal"/>
                            </span>
                          </xsl:when>
                          <xsl:when test="$priorityVal &gt;= 0.6">
                            <span class="priority-pill priority-med">
                              <xsl:value-of select="$priorityVal"/>
                            </span>
                          </xsl:when>
                          <xsl:otherwise>
                            <span class="priority-pill priority-low">
                              <xsl:value-of select="$priorityVal"/>
                            </span>
                          </xsl:otherwise>
                        </xsl:choose>
                      </td>
                      <td>
                        <span class="badge-freq">
                          <xsl:value-of select="sitemap:changefreq | changefreq | *[local-name()='changefreq']"/>
                        </span>
                      </td>
                      <td>
                        <span class="date-text">
                          <xsl:value-of select="sitemap:lastmod | lastmod | *[local-name()='lastmod']"/>
                        </span>
                      </td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <footer class="footer">
            <p>Generated for <a href="https://luevora.com">Luevora Platform</a> &bull; Search Engine Optimization Architecture</p>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>

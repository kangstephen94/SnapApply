// ═══════════════════════════════════════════════════════════════════
// Job Posting Detector — Content Script
// Runs on job board pages, extracts job details, shows save widget
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ─── Platform Detectors ────────────────────────────────────────
  // Each returns { company, role, url } or null

  var detectors = {

    greenhouse: function() {
      var host = location.hostname;
      if (host.indexOf('greenhouse.io') < 0) return null;

      var role = '';
      var company = '';

      // Parse from page title first — most reliable
      // Greenhouse titles: "Job Application for Role at Company" or "Role at Company"
      var title = document.title;
      var jobAppMatch = title.match(/^job\s+application\s+for\s+(.+?)\s+at\s+(.+?)(?:\s*[-–|]|$)/i);
      if (jobAppMatch) {
        role = jobAppMatch[1].trim();
        company = jobAppMatch[2].trim();
      } else {
        var atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[-–|]|$)/i);
        if (atMatch) {
          role = atMatch[1].trim();
          company = atMatch[2].trim();
        }
      }

      // If title didn't work, try DOM selectors
      if (!role) {
        var appTitle = document.querySelector('.app-title') ||
                       document.querySelector('h1[class*="job-title"]') ||
                       document.querySelector('h1.heading') ||
                       document.querySelector('#header .app-title');
        if (appTitle) role = appTitle.textContent.trim();
      }

      if (!company) {
        var companyEl = document.querySelector('.company-name') ||
                        document.querySelector('.logo-wrapper img');
        if (companyEl) {
          company = companyEl.alt || companyEl.textContent.trim();
        }
      }

      if (!role && !company) return null;
      return { company: company, role: role, url: location.href };
    },

    lever: function() {
      if (location.hostname !== 'jobs.lever.co') return null;

      var role = '';
      var company = '';

      var headingEl = document.querySelector('.posting-headline h2') ||
                      document.querySelector('[data-qa="posting-name"]');
      if (headingEl) role = headingEl.textContent.trim();

      // Company from path: /company/posting-id
      var pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 1) {
        company = pathParts[0].replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      }

      // Override with page title if better
      var title = document.title;
      var dashMatch = title.match(/^(.+?)\s*[-–]\s*(.+)/);
      if (dashMatch) {
        var possible = dashMatch[2].trim();
        if (possible && possible.length < 60) company = possible;
      }

      if (!role) return null;
      return { company: company, role: role, url: location.href };
    },

    ashby: function() {
      if (location.hostname !== 'jobs.ashbyhq.com') return null;

      var role = '';
      var company = '';

      var h1 = document.querySelector('h1');
      if (h1) role = h1.textContent.trim();

      // Company from path or page elements
      var pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 1) {
        company = pathParts[0].replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      }

      if (!role) return null;
      return { company: company, role: role, url: location.href };
    },

    workday: function() {
      if (location.hostname.indexOf('myworkdayjobs.com') < 0) return null;

      var role = '';
      var company = '';

      var titleEl = document.querySelector('[data-automation-id="jobPostingHeader"]') ||
                    document.querySelector('h2[data-automation-id="header"]') ||
                    document.querySelector('h1') ||
                    document.querySelector('.css-13mho1v');
      if (titleEl) role = titleEl.textContent.trim();

      // Company from subdomain: company.wd5.myworkdayjobs.com
      var hostParts = location.hostname.split('.');
      if (hostParts.length >= 1) {
        company = hostParts[0].replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      }

      if (!role) return null;
      return { company: company, role: role, url: location.href };
    },

    linkedin: function() {
      if (location.hostname.indexOf('linkedin.com') < 0) return null;
      if (location.pathname.indexOf('/jobs/') < 0) return null;

      var role = '';
      var company = '';

      // Job detail pane
      var titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1') ||
                    document.querySelector('.jobs-unified-top-card__job-title') ||
                    document.querySelector('.t-24.t-bold.inline') ||
                    document.querySelector('h1.topcard__title') ||
                    document.querySelector('h2.t-24');
      if (titleEl) role = titleEl.textContent.trim();

      var companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name') ||
                      document.querySelector('.jobs-unified-top-card__company-name a') ||
                      document.querySelector('.topcard__org-name-link') ||
                      document.querySelector('a.topcard__org-name-link');
      if (companyEl) company = companyEl.textContent.trim();

      if (!role) return null;
      return { company: company, role: role, url: location.href };
    },

    indeed: function() {
      if (location.hostname.indexOf('indeed.com') < 0) return null;

      var role = '';
      var company = '';

      // Indeed job view page
      var titleEl = document.querySelector('h1.jobsearch-JobInfoHeader-title') ||
                    document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
                    document.querySelector('.jobsearch-JobInfoHeader-title') ||
                    document.querySelector('h1[class*="JobTitle"]') ||
                    document.querySelector('.jcs-JobTitle') ||
                    document.querySelector('h2.jobTitle');
      if (titleEl) role = titleEl.textContent.trim();

      // Company name selectors
      var companyEl = document.querySelector('[data-testid="inlineHeader-companyName"]') ||
                      document.querySelector('[data-testid="jobsearch-InlineCompanyRating"]') ||
                      document.querySelector('.jobsearch-InlineCompanyRating a') ||
                      document.querySelector('.jobsearch-InlineCompanyRating div') ||
                      document.querySelector('[data-company-name]') ||
                      document.querySelector('.companyName') ||
                      document.querySelector('span.css-1h7lukg');
      if (companyEl) {
        company = companyEl.getAttribute('data-company-name') || companyEl.textContent.trim();
      }

      // Fallback: parse page title "Role - Company - Indeed.com"
      if (!company || !role) {
        var title = document.title;
        var parts = title.split(/\s*[-–]\s*/);
        if (parts.length >= 3) {
          if (!role && parts[0]) role = parts[0].trim();
          if (!company && parts[1]) company = parts[1].replace(/\s*hiring.*$/i, '').trim();
        }
      }

      // Clean up "- job post" suffix from role
      if (role) role = role.replace(/\s*[-–]\s*job post$/i, '').trim();

      if (!role) return null;
      return { company: company, role: role, url: location.href };
    },

    levelsfyi: function() {
      if (location.hostname.indexOf('levels.fyi') < 0) return null;

      var role = '';
      var company = '';

      // Levels.fyi job page: /companies/{company}/jobs/{id}/{title}
      var pathParts = location.pathname.split('/').filter(Boolean);

      // URL pattern: /companies/google/jobs/12345/software-engineer
      if (pathParts[0] === 'companies' && pathParts.length >= 2) {
        company = pathParts[1].replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      }

      // Job listing page: /jobs?...
      // Try page content for role
      var titleEl = document.querySelector('h1') ||
                    document.querySelector('[class*="JobTitle"]') ||
                    document.querySelector('[class*="job-title"]') ||
                    document.querySelector('[data-testid="job-title"]');
      if (titleEl) {
        var text = titleEl.textContent.trim();
        if (text.length > 3 && text.length < 150) role = text;
      }

      // Fallback: page title often has "Role at Company | Levels.fyi"
      if (!role || !company) {
        var title = document.title;
        var atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|]|$)/i);
        if (atMatch) {
          if (!role) role = atMatch[1].trim();
          if (!company) company = atMatch[2].trim();
        }
        // Also try "Role - Company | Levels.fyi"
        if (!role) {
          var dashMatch = title.match(/^(.+?)\s*[-–]\s*(.+?)(?:\s*[|]|$)/);
          if (dashMatch) {
            if (!role) role = dashMatch[1].trim();
            if (!company) company = dashMatch[2].trim();
          }
        }
      }

      // Try meta description for additional context
      if (!company) {
        var metaDesc = document.querySelector('meta[name="description"]') ||
                       document.querySelector('meta[property="og:description"]');
        if (metaDesc) {
          var descMatch = metaDesc.content.match(/at\s+(.+?)(?:\.|,|\s+in\s)/i);
          if (descMatch) company = descMatch[1].trim();
        }
      }

      if (!role) return null;
      return { company: company || '', role: role, url: location.href };
    },

    // Generic fallback — tries common patterns
    generic: function() {
      var role = '';
      var company = '';

      // First try the page title — often the cleanest source
      // Common patterns: "Role at Company", "Role - Company", "Role | Company"
      var title = document.title;
      var titleParsed = false;

      var atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[-–|]|$)/i);
      if (atMatch && atMatch[1].length < 100) {
        role = atMatch[1].trim();
        company = atMatch[2].trim();
        titleParsed = true;
      }
      if (!titleParsed) {
        var dashMatch = title.match(/^(.+?)\s*[-–|]\s*(.+?)(?:\s*[-–|]|$)/);
        if (dashMatch && dashMatch[1].length < 100 && dashMatch[1].length > 3) {
          role = dashMatch[1].trim();
          company = dashMatch[2].trim();
          titleParsed = true;
        }
      }

      // Then try DOM selectors for role
      if (!role) {
        var selectors = [
          'h1[class*="job-title"]', 'h1[class*="jobtitle"]', 'h1[class*="position"]',
          'h2[class*="job-title"]', '[data-testid="job-title"]',
          '.job-title h1', '.posting-title', '.job-header h1',
          'h1'
        ];
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el) {
            var text = el.textContent.trim();
            if (text.length > 3 && text.length < 150) {
              role = text;
              break;
            }
          }
        }
      }

      // Try to get company from meta tags
      if (!company) {
        var ogSite = document.querySelector('meta[property="og:site_name"]');
        if (ogSite) company = ogSite.content;
      }

      if (!company) {
        var atMatch2 = title.match(/(?:at|@)\s+(.+?)(?:\s*[-–|]|$)/i);
        if (atMatch2) company = atMatch2[1].trim();
      }

      // Clean up the role
      if (role) role = cleanRole(role);

      if (!role) return null;
      return { company: company || '', role: role, url: location.href };
    }
  };

  // ─── Role cleanup ──────────────────────────────────────────────
  function cleanRole(role) {
    if (!role) return role;

    // Strip common prefixes
    var prefixes = [
      /^job\s*application\s*(?:for|:|-|–)?\s*/i,
      /^apply\s*(?:for|to|:|-|–)?\s*/i,
      /^application\s*(?:for|:|-|–)?\s*/i,
      /^we(?:'re| are)\s+hiring\s*(?:a|an|:|-|–)?\s*/i,
      /^hiring\s*(?:a|an|:|-|–)?\s*/i,
      /^job\s*(?:posting|opening|listing)\s*(?:for|:|-|–)?\s*/i,
      /^open\s*(?:position|role)\s*(?:for|:|-|–)?\s*/i,
      /^position\s*(?::|-|–)\s*/i,
      /^role\s*(?::|-|–)\s*/i,
    ];
    for (var i = 0; i < prefixes.length; i++) {
      role = role.replace(prefixes[i], '');
    }

    // Strip common suffixes
    var suffixes = [
      /\s*[-–|]\s*job\s*(?:application|posting|opening|listing)?\s*$/i,
      /\s*[-–|]\s*apply\s*(?:now|here|today)?\s*$/i,
      /\s*[-–|]\s*careers?\s*$/i,
      /\s*\(\s*remote\s*\)\s*$/i,  // keep this info but normalize: handled below
    ];
    for (var j = 0; j < suffixes.length; j++) {
      role = role.replace(suffixes[j], '');
    }

    return role.trim();
  }

  // ─── Detection orchestrator ────────────────────────────────────
  function detectJob() {
    // Try platform-specific detectors first, then generic
    var order = ['greenhouse', 'lever', 'ashby', 'workday', 'linkedin', 'indeed', 'levelsfyi', 'generic'];
    for (var i = 0; i < order.length; i++) {
      var result = detectors[order[i]]();
      if (result && (result.role || result.company)) {
        // Clean role for all detectors
        if (result.role) result.role = cleanRole(result.role);
        return result;
      }
    }
    return null;
  }

  // ─── Widget UI ─────────────────────────────────────────────────
  function createWidget(jobData) {
    // Remove existing widget if any
    var existing = document.getElementById('jt-ext-widget');
    if (existing) existing.remove();

    var widget = document.createElement('div');
    widget.id = 'jt-ext-widget';
    widget.className = 'jt-ext-widget';

    // Check if already saved
    chrome.storage.local.get('job-apps', function(data) {
      var apps = data['job-apps'] ? JSON.parse(data['job-apps']) : [];
      var isDuplicate = apps.some(function(a) {
        return a.url === jobData.url ||
          (a.company.toLowerCase() === jobData.company.toLowerCase() &&
           a.role.toLowerCase() === jobData.role.toLowerCase());
      });

      if (isDuplicate) {
        widget.innerHTML = buildSavedHTML();
      } else {
        widget.innerHTML = buildDetectedHTML(jobData);
        attachEventListeners(widget, jobData);
      }
      document.body.appendChild(widget);

      // Animate in
      requestAnimationFrame(function() {
        widget.classList.add('jt-ext-visible');
      });
    });
  }

  function buildDetectedHTML(job) {
    return '<div class="jt-ext-inner">' +
      '<div class="jt-ext-header">' +
        '<div class="jt-ext-icon">💼</div>' +
        '<div class="jt-ext-title">Job Detected</div>' +
        '<button class="jt-ext-close" id="jt-close">✕</button>' +
      '</div>' +
      '<div class="jt-ext-body">' +
        '<div class="jt-ext-company">' + escapeHtml(job.company || 'Unknown Company') + '</div>' +
        '<div class="jt-ext-role">' + escapeHtml(job.role || 'Unknown Role') + '</div>' +
      '</div>' +
      '<div class="jt-ext-actions">' +
        '<button class="jt-ext-btn jt-ext-btn-primary" id="jt-save">📤 Save to Tracker</button>' +
        '<button class="jt-ext-btn jt-ext-btn-secondary" id="jt-edit">✏️ Edit & Save</button>' +
      '</div>' +
      '<div class="jt-ext-edit-form" id="jt-edit-form" style="display:none;">' +
        '<label class="jt-ext-label">Company' +
          '<input class="jt-ext-input" id="jt-field-company" value="' + escapeAttr(job.company) + '">' +
        '</label>' +
        '<label class="jt-ext-label">Role' +
          '<input class="jt-ext-input" id="jt-field-role" value="' + escapeAttr(job.role) + '">' +
        '</label>' +
        '<label class="jt-ext-label">Notes' +
          '<input class="jt-ext-input" id="jt-field-notes" placeholder="Referral, recruiter...">' +
        '</label>' +
        '<button class="jt-ext-btn jt-ext-btn-primary" id="jt-save-edited" style="width:100%;margin-top:6px;">✅ Save</button>' +
      '</div>' +
    '</div>';
  }

  function buildSavedHTML() {
    return '<div class="jt-ext-inner jt-ext-saved">' +
      '<div class="jt-ext-header">' +
        '<div class="jt-ext-icon">✅</div>' +
        '<div class="jt-ext-title">Already Tracked</div>' +
        '<button class="jt-ext-close" id="jt-close">✕</button>' +
      '</div>' +
      '<div class="jt-ext-body">' +
        '<div class="jt-ext-role" style="color:#6B7280;">This job is already in your tracker.</div>' +
      '</div>' +
    '</div>';
  }

  function buildSuccessHTML() {
    return '<div class="jt-ext-inner jt-ext-success">' +
      '<div class="jt-ext-header">' +
        '<div class="jt-ext-icon">🎉</div>' +
        '<div class="jt-ext-title">Saved!</div>' +
        '<button class="jt-ext-close" id="jt-close">✕</button>' +
      '</div>' +
      '<div class="jt-ext-body">' +
        '<div class="jt-ext-role" style="color:#065F46;">Added to your Job Tracker.</div>' +
      '</div>' +
    '</div>';
  }

  function attachEventListeners(widget, jobData) {
    // Close button
    widget.addEventListener('click', function(e) {
      if (e.target.id === 'jt-close') {
        widget.classList.remove('jt-ext-visible');
        setTimeout(function() { widget.remove(); }, 300);
      }

      // Quick save
      if (e.target.id === 'jt-save') {
        saveJob({
          company: jobData.company || 'Unknown',
          role: jobData.role || 'Unknown',
          url: jobData.url,
          status: 'Applied',
          notes: '',
          date: new Date().toISOString().split('T')[0],
        }, widget);
      }

      // Toggle edit form
      if (e.target.id === 'jt-edit') {
        var form = document.getElementById('jt-edit-form');
        if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
      }

      // Save edited
      if (e.target.id === 'jt-save-edited') {
        var company = document.getElementById('jt-field-company');
        var role = document.getElementById('jt-field-role');
        var notes = document.getElementById('jt-field-notes');
        saveJob({
          company: company ? company.value : jobData.company,
          role: role ? role.value : jobData.role,
          url: jobData.url,
          status: 'Applied',
          notes: notes ? notes.value : '',
          date: new Date().toISOString().split('T')[0],
        }, widget);
      }
    });
  }

  function saveJob(job, widget) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    job.id = id;

    chrome.storage.local.get('job-apps', function(data) {
      var apps = data['job-apps'] ? JSON.parse(data['job-apps']) : [];
      apps.unshift(job);
      chrome.storage.local.set({ 'job-apps': JSON.stringify(apps) }, function() {
        // Show success state
        widget.innerHTML = buildSuccessHTML();
        // Re-attach close listener
        widget.addEventListener('click', function(e) {
          if (e.target.id === 'jt-close') {
            widget.classList.remove('jt-ext-visible');
            setTimeout(function() { widget.remove(); }, 300);
          }
        });
        // Auto-dismiss after 3s
        setTimeout(function() {
          widget.classList.remove('jt-ext-visible');
          setTimeout(function() { widget.remove(); }, 300);
        }, 3000);
      });
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  }

  // ─── Init ──────────────────────────────────────────────────────
  function init() {
    // If widget already exists on page, remove it and re-detect (allows Scan Page to refresh)
    var existing = document.getElementById('jt-ext-widget');
    if (existing) existing.remove();

    // Wait a moment for dynamic content to load (SPAs)
    setTimeout(function() {
      var job = detectJob();
      if (job) {
        createWidget(job);
      }
    }, 1500);

    // Only set up the SPA observer once (check for marker)
    if (!document.__jtObserverActive) {
      document.__jtObserverActive = true;
      var lastUrl = location.href;
      var observer = new MutationObserver(function() {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          setTimeout(function() {
            var widget = document.getElementById('jt-ext-widget');
            if (widget) widget.remove();
            var job = detectJob();
            if (job) createWidget(job);
          }, 2000);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

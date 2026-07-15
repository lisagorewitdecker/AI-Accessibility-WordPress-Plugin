/* global jQuery, aacc_admin */
(function ($) {
  'use strict';

  /**
   * Trigger a manual accessibility scan for the current post.
   */
  function scanNow() {
    const postId = $('#aiacc-meta-box').data('post-id');
    const $btn   = $('#aiacc-scan-now');
    const $status = $('#aiacc-scan-status');

    if (!postId) {
      return;
    }

    // Collect post content from the editor
    let html = '';
    if (typeof window.tinymce !== 'undefined' && tinymce.get('content')) {
      html = tinymce.get('content').getContent();
    } else {
      const $editor = $('#content');
      if ($editor.length) {
        html = $editor.val();
      }
    }

    if (!html.trim()) {
      $status.text('No content to scan.');
      return;
    }

    $btn.prop('disabled', true);
    $status.text(aacc_admin.i18n.scanning);

    $.ajax({
      url:         aacc_admin.rest_url + 'analyze',
      method:      'POST',
      contentType: 'application/json',
      beforeSend:  function (xhr) {
        xhr.setRequestHeader('X-WP-Nonce', aacc_admin.nonce);
      },
      data: JSON.stringify({
        html:      html,
        post_id:   postId,
        enable_ai: false,
      }),
    })
      .done(function (report) {
        $status.text('');
        renderReport(report);
      })
      .fail(function () {
        $status.text(aacc_admin.i18n.scan_error);
      })
      .always(function () {
        $btn.prop('disabled', false);
      });
  }

  /**
   * Render a report object into the meta box.
   *
   * @param {Object} report
   */
  function renderReport(report) {
    const levelClass = 'aiacc-score-' + report.wcag_level.toLowerCase();
    let html = '<p>' +
      '<strong>Score:</strong> ' + report.score + '/100 ' +
      '<span class="aiacc-score-badge ' + levelClass + '">' + report.wcag_level + '</span>' +
      '</p>' +
      '<p><strong>Issues found:</strong> ' + report.issue_count + '</p>';

    if (report.issues && report.issues.length > 0) {
      html += '<details><summary>View issues</summary><ul class="aiacc-issue-list">';
      report.issues.forEach(function (issue) {
        html += '<li><code>' + escHtml(issue.type) + '</code>: ' + escHtml(issue.message) + '</li>';
      });
      html += '</ul></details>';
    }

    html += '<p class="description">Last scanned: ' + escHtml(report.generated_at) + '</p>';
    html += '<button type="button" id="aiacc-scan-now" class="button">Scan Now</button>';
    html += '<span id="aiacc-scan-status"></span>';

    $('#aiacc-meta-box').html(html);
    bindEvents();
  }

  /**
   * Escape HTML special characters.
   *
   * @param {string} str
   * @returns {string}
   */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bindEvents() {
    $(document).off('click', '#aiacc-scan-now').on('click', '#aiacc-scan-now', scanNow);
  }

  $(function () {
    bindEvents();
  });
}(jQuery));

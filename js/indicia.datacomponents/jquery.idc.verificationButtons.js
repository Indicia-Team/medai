/**
 * Indicia, the OPAL Online Recording Toolkit.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses/gpl.html.
 *
 * @author Indicia Team
 * @license http://www.gnu.org/licenses/gpl.html GPL 3.0
 * @link https://github.com/indicia-team/client_helpers
 */

 /**
* Output plugin for verification buttons.
*/
(function idcVerificationButtons() {
  'use strict';
  var $ = jQuery;

  /**
   * Declare default settings.
   */
  var defaults = {
  };

  /**
   * Registered callbacks for events.
   */
  var callbacks = {
  };

  var dataGrid;

  var saveVerifyComment = function saveVerifyComment(occurrenceIds, status, comment) {
    var commentToSave;
    var data = {
      website_id: indiciaData.website_id,
      user_id: indiciaData.user_id
    };
    var doc = {
      identification: {}
    };
    var indiciaPostUrl;
    if (status.status) {
      indiciaPostUrl = indiciaData.ajaxFormPostSingleVerify;
      commentToSave = comment.trim() === ''
        ? indiciaData.statusMsgs[status.status]
        : comment.trim();
      $.extend(data, {
        'occurrence:ids': occurrenceIds.join(','),
        'occurrence:record_decision_source': 'H',
        'occurrence:record_status': status.status[0],
        'occurrence_comment:comment': commentToSave
      });
      doc.identification.verification_status = status.status[0];
      if (status.status.length > 1) {
        data['occurrence:record_substatus'] = status.status[1];
        doc.identification.verification_substatus = status.status[1];
      }
      // Post update to Indicia.
      $.post(
        indiciaPostUrl,
        data,
        function success() {

        }
      );
    } else if (status.query) {
      // No bulk API for query updates at the moment, so process one at a time.
      indiciaPostUrl = indiciaData.ajaxFormPostComment;
      doc.identification.query = status.query;
      commentToSave = comment.trim() === ''
        ? 'This record has been queried.'
        : comment.trim();
      $.each(occurrenceIds, function eachOccurrence() {
        $.extend(data, {
          'occurrence_comment:query': 't',
          'occurrence_comment:occurrence_id': this,
          'occurrence_comment:comment': commentToSave
        });
        // Post update to Indicia.
        $.post(
          indiciaPostUrl,
          data,
          function success() {

          }
        );
      });
    }

    // Now post update to Elasticsearch.
    data = {
      ids: occurrenceIds,
      doc: doc
    };
    $.ajax({
      url: indiciaData.esProxyAjaxUrl + '/updateids/' + indiciaData.nid,
      type: 'post',
      data: data,
      success: function success(response) {
        if (typeof response.error !== 'undefined' || (response.code && response.code !== 200)) {
          alert('Elasticsearch update failed');
        } else {
          if (response.updated !== occurrenceIds.length) {
            alert('An error occurred whilst updating the reporting index. It may not reflect your changes temporarily but will be updated automatically later.');
          }
          $(dataGrid).idcDataGrid('hideRowAndMoveNext');
          $(dataGrid).find('.multiselect-all').prop('checked', false);
        }
      },
      error: function error(jqXHR, textStatus, errorThrown) {
        alert('Elasticsearch update failed');
      },
      dataType: 'json'
    });
  };

  var commentPopup = function commentPopup(status) {
    var doc;
    var fs;
    var heading;
    var statusData = [];
    var overallStatus = status.status ? status.status : status.query;
    var selectedTrs = $(dataGrid).find('table').hasClass('multiselect-mode')
      ? $(dataGrid).find('.multiselect:checked').closest('tr')
      : $(dataGrid).find('tr.selected');
    var ids = [];
    if (selectedTrs.length === 0) {
      alert('There are no selected records');
      return;
    }
    $.each(selectedTrs, function eachRow() {
      doc = JSON.parse($(this).attr('data-doc-source'));
      ids.push(parseInt(doc.id, 10));
    });
    if (status.status) {
      statusData.push('data-status="' + status.status + '"');
    }
    if (status.query) {
      statusData.push('data-query="' + status.query + '"');
    }
    fs = $('<fieldset class="comment-popup" data-ids="' + JSON.stringify(ids) + '" ' + statusData.join('') + '>');
    if (selectedTrs.length > 1) {
      heading = status.status
        ? 'Set status to ' + indiciaData.statusMsgs[overallStatus] + ' for ' + selectedTrs.length + ' records'
        : 'Query ' + selectedTrs.length + ' records';
      $('<div class="alert alert-info">You are updating multiple records!</alert>').appendTo(fs);
    } else {
      heading = status.status
        ? 'Set status to ' + indiciaData.statusMsgs[overallStatus]
        : 'Query this record';
    }
    $('<legend><span class="' + indiciaData.statusClasses[overallStatus] + ' fa-2x"></span>' + heading + '</legend>')
      .appendTo(fs);
    $('<label for="comment-textarea">Add the following comment:</label>').appendTo(fs);
    $('<textarea id="comment-textarea">').appendTo(fs);
    $('<button class="btn btn-primary">Save</button>').appendTo(fs);
    $.fancybox(fs);
  };

  /**
   * Declare public methods.
   */
  var methods = {
    /**
     * Initialise the idcVerificationButtons plugin.
     *
     * @param array options
     */
    init: function init(options) {
      var el = this;

      el.settings = $.extend({}, defaults);
      // Apply settings passed in the HTML data-* attribute.
      if (typeof $(el).attr('data-idc-config') !== 'undefined') {
        $.extend(el.settings, JSON.parse($(el).attr('data-idc-config')));
      }
      // Apply settings passed to the constructor.
      if (typeof options !== 'undefined') {
        $.extend(el.settings, options);
      }
      // Validate settings.
      if (typeof el.settings.showSelectedRow === 'undefined') {
        indiciaFns.controlFail(el, 'Missing showSelectedRow config for table.');
      }
      dataGrid = $('#' + el.settings.showSelectedRow);
      $(dataGrid).idcDataGrid('on', 'rowSelect', function rowSelect(tr) {
        var sep;
        var doc;
        var key;
        var keyParts;
        $('.external-record-link').remove();
        if (tr) {
          // Update the view and edit button hrefs. This allows the user to
          // right click and open in a new tab, rather than have an active
          // button.
          doc = JSON.parse($(tr).attr('data-doc-source'));
          $('.idc-verification-buttons').show();
          sep = el.settings.viewPath.indexOf('?') === -1 ? '?' : '&';
          $(el).find('.view').attr('href', el.settings.viewPath + sep + 'occurrence_id=' + doc.id);
          $(el).find('.edit').attr('href', el.settings.editPath + sep + 'occurrence_id=' + doc.id);
          // Deprecated doc field mappings had occurrence_external_key instead
          // of occurrence.source_system_key. This line can be removed if the
          // index has been rebuilt.
          if (doc.occurrence.source_system_key || doc.occurrence_external_key) {
            key = doc.occurrence.source_system_key ? doc.occurrence.source_system_key : doc.occurrence_external_key;
            if (key.match(/^iNat:/)) {
              keyParts = key.split(':');
              $(el).find('.view').after('<a href="https://www.inaturalist.org/observations/' + keyParts[1] + '" ' +
                'target="_blank" title="View source record on iNaturalist" class="external-record-link">' +
                '<span class="fas fa-file-invoice"></span>iNaturalist</a>');
            }
          }
        } else {
          $('.idc-verification-buttons').hide();
        }
      });
      $(dataGrid).idcDataGrid('on', 'populate', function rowSelect() {
        $('.idc-verification-buttons').hide();
      });
      $(el).find('button.verify').click(function buttonClick(e) {
        var status = $(e.currentTarget).attr('data-status');
        commentPopup({ status: status });
      });
      $(el).find('button.query').click(function buttonClick(e) {
        var query = $(e.currentTarget).attr('data-query');
        commentPopup({ query: query });
      });
      indiciaFns.on('click', '.comment-popup button', {}, function onClickSave(e) {
        var popup = $(e.currentTarget).closest('.comment-popup');
        var ids = JSON.parse($(popup).attr('data-ids'));
        var statusData = {};
        if ($(popup).attr('data-status')) {
          statusData.status = $(popup).attr('data-status');
        }
        if ($(popup).attr('data-query')) {
          statusData.query = $(popup).attr('data-query');
        }
        saveVerifyComment(ids, statusData, $(popup).find('textarea').val());
        $.fancybox.close();
      });
      $(el).find('.l1').hide();
      $(el).find('.toggle').click(function toggleClick(e) {
        if ($(e.currentTarget).hasClass('fa-toggle-on')) {
          $(e.currentTarget).removeClass('fa-toggle-on');
          $(e.currentTarget).addClass('fa-toggle-off');
          $(el).find('.l2').hide();
          $(el).find('.l1').show();
        } else {
          $(e.currentTarget).removeClass('fa-toggle-off');
          $(e.currentTarget).addClass('fa-toggle-on');
          $(el).find('.l1').hide();
          $(el).find('.l2').show();
        }
      });
    },

    on: function on(event, handler) {
      if (typeof callbacks[event] === 'undefined') {
        indiciaFns.controlFail(this, 'Invalid event handler requested for ' + event);
      }
      callbacks[event].push(handler);
    },

    /**
     * No need to re-populate if source updates.
     */
    getNeedsPopulation: function getNeedsPopulation() {
      return false;
    }
  };

    /**
   * Extend jQuery to declare idcVerificationButtons plugin.
   */
  $.fn.idcVerificationButtons = function buildVerificationButtons(methodOrOptions) {
    var passedArgs = arguments;
    $.each(this, function callOnEachGrid() {
      if (methods[methodOrOptions]) {
        // Call a declared method.
        return methods[methodOrOptions].apply(this, Array.prototype.slice.call(passedArgs, 1));
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init".
        return methods.init.apply(this, passedArgs);
      }
      // If we get here, the wrong method was called.
      $.error('Method ' + methodOrOptions + ' does not exist on jQuery.idcVerificationButtons');
      return true;
    });
    return this;
  };
}());

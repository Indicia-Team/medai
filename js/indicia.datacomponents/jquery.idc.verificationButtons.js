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
   * Currently selected row ID.
   */
  var occurrenceId;

  /**
   * Declare default settings.
   */
  var defaults = {
    keyboardNavigation: false
  };

  /**
   * Registered callbacks for events.
   */
  var callbacks = {
  };

  /**
   * jQuery validation instance.
   */
  var emailFormvalidator;

  /**
   * jQuery validation instance.
   */
  var redetFormValidator;

  /**
   * Control outputting the list of docs we are verifying - dataGrid or cardGallery.
   */
  var listOutputControl;

  /**
   * Class name for the list output control.
   */
  var listOutputControlClass;

  /**
   * Flag to prevent double click on Query button.
   */
  var doingQueryPopup = false;

  /**
   * Saves the comment associated with a verification or query event.
   */
  function saveVerifyComment(occurrenceIds, status, comment, email) {
    var commentToSave;
    var allTableMode = $(listOutputControl).find('.multi-mode-table.active').length > 0;
    var data = {
      website_id: indiciaData.website_id,
      user_id: indiciaData.user_id
    };
    var docUpdates = {
      identification: {}
    };
    var indiciaPostUrl;
    var requests = 0;
    var currentDoc;
    if (email && indiciaData.workflowEnabled) {
      // This will only be the case when querying a single record. If the
      // species requires fully logged comms, add the email body to the
      // comment.
      currentDoc = JSON.parse($(listOutputControl).find('.selected').attr('data-doc-source'));
      if (indiciaData.workflowTaxonMeaningIDsLogAllComms.indexOf(currentDoc.taxon.taxon_meaning_id) !== -1) {
        data['occurrence_comment:correspondence_data'] = JSON.stringify({
          email: [{
            from: indiciaData.siteEmail,
            to: email.to,
            subject: email.subject,
            body: email.body
          }]
        });
      }
    }
    // Since this might be slow.
    $('body').append('<div class="loading-spinner"><div>Loading...</div></div>');
    if (status.status) {
      commentToSave = comment.trim() === ''
        ? indiciaData.statusMsgs[status.status]
        : comment.trim();
      $.extend(data, {
        'occurrence:record_decision_source': 'H',
        'occurrence:record_status': status.status[0],
        'occurrence_comment:comment': commentToSave
      });
      if (allTableMode) {
        indiciaPostUrl = indiciaData.esProxyAjaxUrl + '/verifyall/' + indiciaData.nid;
        // Loop sources, only 1 will apply.
        $.each($(listOutputControl)[0].settings.source, function eachSource(sourceId) {
          $.extend(data, {
            'occurrence:idsFromElasticFilter': indiciaFns.getFormQueryData(indiciaData.esSourceObjects[sourceId])
          });
          return false;
        });
      } else {
        indiciaPostUrl = indiciaData.ajaxFormPostSingleVerify;
        data['occurrence:ids'] = occurrenceIds.join(',');
      }
      docUpdates.identification.verification_status = status.status[0];
      if (status.status.length > 1) {
        data['occurrence:record_substatus'] = status.status[1];
        docUpdates.identification.verification_substatus = status.status[1];
      }
      // Post update to Indicia.
      requests++;
      $.post(
        indiciaPostUrl,
        data,
        function success(response) {
          if (allTableMode) {
            $('body > .loading-spinner').remove();
            // Unset all table mode as this is a "dangerous" state that should be explicitly chosen each time.
            $(listOutputControl).find('.multi-mode-table.active').removeClass('active');
            $(listOutputControl).find('.multi-mode-selected').addClass('active');
            indiciaFns.populateDataSources();
          } else if (response !== 'OK') {
            alert('Indicia records update failed');
          }
        }
      ).always(function cleanup() {
        requests--;
        if (requests <= 0) {
          $('body > .loading-spinner').remove();
        }
      });
      // In all table mode, everything handled by the ES proxy so nothing else to do.
      if (allTableMode) {
        return;
      }
    } else if (status.query) {
      // No bulk API for query updates at the moment, so process one at a time.
      indiciaPostUrl = indiciaData.ajaxFormPostComment;
      docUpdates.identification.query = status.query;
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
          data
        ).always(function cleanup() {
          requests--;
          if (requests <= 0) {
            $('body > .loading-spinner').remove();
          }
        });
      });
    }

    // Now post update to Elasticsearch.
    data = {
      ids: occurrenceIds,
      doc: docUpdates
    };
    $.ajax({
      url: indiciaData.esProxyAjaxUrl + '/verifyids/' + indiciaData.nid,
      type: 'post',
      data: data,
      success: function success(response) {
        if (typeof response.error !== 'undefined' || (response.code && response.code !== 200)) {
          alert(indiciaData.lang.verificationButtons.elasticsearchUpdateError);
        } else {
          // Check updated count is as expected.
          if (response.updated < occurrenceIds.length) {
            alert(indiciaData.lang.verificationButtons.elasticsearchUpdateError);
          }
          // Refresh and cleanup.
          $('body > .loading-spinner').remove();
          if (occurrenceIds.length > 1) {
            indiciaFns.populateDataSources();
          } else if (occurrenceIds.length === 1) {
            indiciaFns.hideItemAndMoveNext(listOutputControl[0]);
          }
          $(listOutputControl).find('.multiselect-all').prop('checked', false);
        }
      },
      error: function error() {
        alert(indiciaData.lang.verificationButtons.elasticsearchUpdateError);
      },
      dataType: 'json'
    }).always(function cleanup() {
      requests--;
      if (requests <= 0) {
        $('body > .loading-spinner').remove();
      }
    });
  }

  /**
   * Displays a popup dialog for capturing a verification or query comment.
   */
  function commentPopup(status, commentInstruction) {
    var doc;
    var fs;
    var heading;
    var statusData = [];
    var overallStatus = status.status ? status.status : status.query;
    var ids = [];
    var todoCount;
    var selectedItems;
    if ($(listOutputControl).find('.multi-mode-table.active').length > 0) {
      todoCount = $(listOutputControl)[0].settings.totalRowCount;
    } else {
      selectedItems = $(listOutputControl).hasClass('multiselect-mode')
        ? $(listOutputControl).find('.multiselect:checked').closest('tr,.card')
        : $(listOutputControl).find('.selected');
      if (selectedItems.length === 0) {
        alert(indiciaData.lang.verificationButtons.nothingSelected);
        return;
      }
      $.each(selectedItems, function eachRow() {
        doc = JSON.parse($(this).attr('data-doc-source'));
        ids.push(parseInt(doc.id, 10));
      });
      todoCount = ids.length;
    }
    if (status.status) {
      statusData.push('data-status="' + status.status + '"');
    }
    if (status.query) {
      statusData.push('data-query="' + status.query + '"');
    }
    fs = $('<fieldset class="comment-popup verification-popup" data-ids="' + JSON.stringify(ids) + '" ' + statusData.join('') + '>');
    if (todoCount > 1) {
      heading = status.status
        ? 'Set status to ' + indiciaData.statusMsgs[overallStatus] + ' for ' + todoCount + ' records'
        : 'Query ' + todoCount + ' records';
      $('<div class="alert alert-info">You are updating multiple records!</alert>').appendTo(fs);
    } else {
      heading = status.status
        ? 'Set status to ' + indiciaData.statusMsgs[overallStatus]
        : 'Query this record';
    }
    $('<legend><span class="' + indiciaData.statusClasses[overallStatus] + ' fa-2x"></span>' + heading + '</legend>')
      .appendTo(fs);
    if (commentInstruction) {
      $('<p class="alert alert-info">' + commentInstruction + '</p>').appendTo(fs);
    }
    $('<div class="form-group">' +
        '<label for="comment-textarea">Add the following comment:</label>' +
        '<textarea id="comment-textarea" class="form-control" rows="6"></textarea>' +
      '</div>').appendTo(fs);
    $('<button class="btn btn-primary">Save</button>').appendTo(fs);
    $.fancybox.open(fs);
  }

  /**
   * Token replacements.
   *
   * Replaces tokens in text (e.g. {{ event.verbatim_location }}) with the
   * contents from fields in an ES document.
   */
  function replaceDocFields(text, doc) {
    var r = text;
    var matches = text.match(/\{\{ ([a-z\._]+) }}/g);
    if (matches) {
      $.each(matches, function() {
        var field = this.replace(/^\{\{ /, '').replace(/ }}$/, '');
        r = r.replace(this, indiciaFns.getValueForField(doc, field));
      });
    }
    return r;
  }

  /**
   * Retrieves key data to include in a record summary in an email.
   */
  function getRecordDataForEmail(doc) {
    var r = [];
    var fields = {
      id: 'ID',
      'taxon.taxon_name': 'Species',
      'event.date_start': 'Date',
      'location.output_sref': 'Grid ref.',
      'location.verbatim_locality': 'Location'
    };
    $.each(fields, function eachField(field, caption) {
      var value = indiciaFns.getValueForField(doc, field);
      if (value) {
        r.push(caption + ': ' + value);
      }
    });
    r.push('{{ photos }}');
    r.push('{{ comments }}');
    r.push('* {{ emailReplyOption }}');
    r.push('* {{ commentReplyOption }}');
    return r.join('\n');
  }

  /**
   * Gets the email address associated with the current record.
   *
   * A callback is used as this may need an AJAX request.
   */
  function getCurrentRecordEmail(doc, callback) {
    if (indiciaData.thisRecordEmail) {
      // indiciaData.thisRecordEmail is filled in by the record details pane.
      callback(indiciaData.thisRecordEmail);
    } else if (indiciaData.thisRecordEmail === null) {
      // If null, then the record details haven't been loaded. Need to load them.
      $.ajax({
        url: indiciaData.esProxyAjaxUrl + '/attrs/' + indiciaData.nid,
        data: { occurrence_id: doc.id },
        success: function success(response) {
          $.each(response, function eachHeading(title, attrs) {
            if (title === 'Recorder attributes') {
              $.each(attrs, function eachAttr() {
                if (this.caption.toLowerCase() === 'email') {
                  callback(this.value);
                  return false;
                }
                return true;
              });
              return false;
            }
            return true;
          });
          // No email address in the attributes.
          callback('');
        }
      });
    } else {
      // indiciaData.thisRecordEmail=false implies record attrs loaded but no
      // email address available.
      callback('');
    }
  }

  /**
   * Get HTML for the query by comment tab's form.
   */
  function getQueryCommentTab(doc, commentInstruct, warning) {
    var commentTab = $('<fieldset class="comment-popup" data-ids="' + JSON.stringify([parseInt(doc.id, 10)]) + '" data-query="Q" />');
    $('<legend><span class="fas fa-question-circle fa-2x"></span>' +
      indiciaData.lang.verificationButtons.commentTabTitle + '</legend>')
      .appendTo(commentTab);
    $('<p class="alert ' + (warning ? 'alert-danger' : 'alert-info') + '">' +
      commentInstruct + '</p>')
      .appendTo(commentTab);
    $('<div class="form-group">' +
        '<label for="comment-textarea">Add the following comment:</label>' +
        '<textarea id="comment-textarea" class="form-control" rows="6"></textarea>' +
      '</div>').appendTo(commentTab);
    $('<button class="btn btn-primary">Add comment</button>').appendTo(commentTab);
    return commentTab;
  }

  /**
   * Get HTML for the query by email tab's form.
   */
  function getQueryEmailTab(doc, emailTo, emailInstruct, warning) {
    var emailTab = $('<fieldset class="query-popup" data-id="' + doc.id +
      '" data-sample-id="' + doc.event.event_id + '" data-query="Q" />');
    var emailSubject = replaceDocFields(indiciaData.lang.verificationButtons.emailQuerySubject, doc);
    var emailBody = replaceDocFields(indiciaData.lang.verificationButtons.emailQueryBodyHeader, doc);
    var recordData = getRecordDataForEmail(doc);
    var form;
    $('<legend><span class="fas fa-question-circle fa-2x"></span>' +
      indiciaData.lang.verificationButtons.emailTabTitle + '</legend>')
      .appendTo(emailTab);
    form = $('<form />').appendTo(emailTab);
    $('<p class="alert ' + (warning ? 'alert-danger' : 'alert-info') + '">' +
      emailInstruct + '</p>')
      .appendTo(form);
    $('<div class="form-group">' +
        '<label for="email-to">Send email to:</label>' +
        '<input id="email-to" class="form-control email required" value="' + emailTo + '" />' +
      '</div>').appendTo(form);
    $('<div class="form-group">' +
        '<label for="email-subject">Email subject:</label>' +
        '<input id="email-subject" class="form-control required" value="' + emailSubject + '" />' +
      '</div>').appendTo(form);
    $('<div class="form-group">' +
        '<label for="email-body">Email body:</label>' +
        '<textarea id="email-body" class="form-control required" rows="12">' + emailBody + '\n\n' + recordData + '</textarea>' +
      '</div>').appendTo(form);
    $('<input type="submit" class="btn btn-primary" value="Send email" />').appendTo(form);
    emailFormvalidator = $(form).validate({});
    $(form).submit(processEmail);
    return emailTab;
  }

  function tabbedQueryPopup(doc, commentFirst, commentInstruct, emailInstruct, emailTo) {
    var commentTab = getQueryCommentTab(doc, commentInstruct, !commentFirst);
    var emailTab = getQueryEmailTab(doc, emailTo, emailInstruct, commentFirst);
    var title1 = commentFirst ? 'Add comment' : 'Send email';
    var title2 = commentFirst ? 'Send email' : 'Add comment';
    var content = $('<div id="popup-tabs" class="verification-popup" />').append($('<ul>' +
      '<li><a href="#tab-query-1">' + title1 + '</li>' +
      '<li><a href="#tab-query-2">' + title2 + '</li>'
    ));
    if (commentFirst) {
      $(commentTab).attr('id', 'tab-query-1');
      $(emailTab).attr('id', 'tab-query-2');
      commentTab.appendTo(content);
      emailTab.appendTo(content);
    } else {
      $(emailTab).attr('id', 'tab-query-1');
      $(commentTab).attr('id', 'tab-query-2');
      emailTab.appendTo(content);
      commentTab.appendTo(content);
    }
    $.fancybox.open(content);
    $('#popup-tabs').tabs();
  }

  /**
   * Display the popup dialog for querying a record.
   */
  function queryPopup() {
    var doc;
    if (doingQueryPopup) {
      return;
    }
    if ($(listOutputControl).hasClass('multiselect-mode')) {
      // As there are multiple records possibly selected, sending an email
      // option not available.
      commentPopup({ query: 'Q' }, indiciaData.lang.verificationButtons.queryInMultiselectMode);
    } else {
      doc = JSON.parse($(listOutputControl).find('.selected').attr('data-doc-source'));
      getCurrentRecordEmail(doc, function callback(emailTo) {
        var t = indiciaData.lang.verificationButtons;
        doc.metadata.created_by_id = 2;
        if (doc.metadata.created_by_id == 1 && emailTo === '' || !emailTo.match(/@/)) {
          // Anonymous record with no valid email.
          tabbedQueryPopup(doc, true, t.queryCommentTabAnonWithoutEmail, t.queryEmailTabAnonWithoutEmail, emailTo);
        } else if (doc.metadata.created_by_id == 1) {
          // Anonymous record with valid email.
          tabbedQueryPopup(doc, false,t.queryCommentTabAnonWithEmail, t.queryEmailTabAnonWithEmail, emailTo);
        } else {
          doingQueryPopup = true;
          // Got a logged in user with email address. Need to know if they check notifications.
          $.ajax({
            url: indiciaData.esProxyAjaxUrl + '/doesUserSeeNotifications/' + indiciaData.nid,
            data: { user_id: doc.metadata.created_by_id },
            success: function success(data) {
              if (data.msg === 'yes' || data.msg === 'maybe') {
                tabbedQueryPopup(doc, true, t.queryCommentTabUserIsNotified, t.queryEmailTabUserIsNotified, emailTo);
              } else {
                tabbedQueryPopup(doc, false, t.queryCommentTabUserIsNotNotified, t.queryEmailTabUserIsNotNotified, emailTo);
              }
            },
            complete: function complete() {
              doingQueryPopup = false;
            }
          });
        }
      });
    }
  }

  /**
   * Handle the next chunk of uploaded decisions spreadsheet.
   */
  function nextSpreadsheetTask(metadata) {
    if (metadata.state === 'checks failed') {
      $('.upload-output').removeClass('alert-info').addClass('alert-danger');
      $('.upload-output .msg').html(
        '<p>The upload failed as errors were found in the spreadsheet so no changes were made to the database. ' +
        'Download the following file which explains the problems: <br/>' +
        '<a href="' + indiciaData.warehouseUrl + 'import/' + metadata.fileId + '-errors.csv"><span class="fas fa-file-csv fa-3x"></span></a><br/>' +
        'Please correct the problems in the original spreadsheet then re-upload it.</p>')
    } else if (metadata.state === 'done') {
      $('.upload-output progress').val(100).show();
      setTimeout(function() {
        alert(metadata.totalProcessed + ' verifications, comments and queries were applied to the database.');
      }, 100);
      $.fancybox.close();
    } else {
      if (metadata.state === 'checking') {
        $('.upload-output .checked').text(metadata.totalChecked);
        $('.upload-output .verifications').text(metadata.verificationsFound);
        $('.upload-output .errors').text(metadata.errorsFound);
        // Set progress bar as indeterminate.
        $('.upload-output progress').show().removeAttr('value');
      } if (metadata.state === 'processing') {
        $('.upload-output dl').hide();
        $('.upload-output progress').show().val(metadata.totalProcessed * 100 / metadata.verificationsFound);
      }

      // UcFirst the state string.
      $('.upload-output .msg').html(metadata.state.charAt(0).toUpperCase() + metadata.state.slice(1) + '...');
      $.ajax({
        url: indiciaData.esProxyAjaxUrl + '/verifyspreadsheet/' + indiciaData.nid,
        type: 'POST',
        dataType: 'json',
        data: { fileId: metadata.fileId },
        success: nextSpreadsheetTask,
        error: function(jqXHR, textStatus, errorThrown) {
          var msg = indiciaData.lang.verificationButtons.uploadError;
          if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
            msg += '<br/>' + jqXHR.responseJSON.message;
          }
          $('.upload-output').removeClass('alert-info').addClass('alert-danger');
          $('.upload-output .msg').html('<p>' + msg + '</p>');
        }
      });
    }
  }

  /**
   * Reset the upload decisions form if it has already been used.
   */
  function resetUploadDecisionsForm() {
    $('.upload-output').removeClass('alert-danger').addClass('alert-info');
    $('#upload-decisions-form .instruct').show();
    $('.upload-output .msg').html('');
    $('.upload-output').hide();
    $('.upload-output .checked').text('0');
    $('.upload-output .verifications').text('0');
    $('.upload-output .errors').text('0');
    $('.upload-output dl').show();
    $('.upload-output progress').hide();
    $('#upload-decisions-file').prop('disabled', false);
    $('#decisions-file').val('');
  }

  /**
   * Click handler for the upload decisions spreadsheet button.
   *
   * Displays the upload decisions dialog.
   */
  function uploadDecisions() {
    if ($('.user-filter.defines-permissions').length === 0) {
      alert(indiciaData.lang.verificationButtons.csvDisallowedMessage);
      return;
    }
    resetUploadDecisionsForm();
    $.fancybox.open($('#upload-decisions-form'), {
      clickSlide: false, // disable close on outside click
      touch: false // disable close on swipe
    });
  }

  /**
   * Click handler for the button which starts the upload decisions process off.
   */
  $('#upload-decisions-file').click(function() {
    var formdata = new FormData();
    var file;
    if($('#decisions-file').prop('files').length > 0) {
      $('#upload-decisions-form .upload-output').show();
      $('#upload-decisions-form .instruct').hide();
      $('#upload-decisions-file').val('').prop('disabled', true);
      file = $('#decisions-file').prop('files')[0];
      formdata.append('decisions', file);
      formdata.append('filter_id', $('.user-filter.defines-permissions').val());
      formdata.append('es_endpoint', indiciaData.esEndpoint);
      formdata.append('id_prefix', indiciaData.idPrefix);
      $.ajax({
        url: indiciaData.esProxyAjaxUrl + '/verifyspreadsheet/' + indiciaData.nid,
        type: 'POST',
        data: formdata,
        processData: false,
        contentType: false,
        success: function (metadata) {
          nextSpreadsheetTask(metadata);
        },
        error: function(jqXHR, textStatus, errorThrown) {
          var msg = indiciaData.lang.verificationButtons.uploadError;
          if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
            msg += '<br/>' + jqXHR.responseJSON.message;
          }
          $('.upload-output').removeClass('alert-info').addClass('alert-danger');
          $('.upload-output .msg').html('<p>' + msg + '</p>');
          $('.upload-output progress').hide();
        }
      });
    }
  });

  /*
   * Saves the authorisation token for the Record Comment Quick Reply.
   *
   * Stored against the occurrence ID to ensure it is not abused.
   *
   * @param string authorisationNumber
   *   Generated random code.
   * @return bool
   *   Indicates if database was successfully written to or not.
   *
   */
  function saveAuthorisationNumberToDb(authorisationNumber, occurrenceId) {
    var data = {
      website_id: indiciaData.website_id,
      'comment_quick_reply_page_auth:occurrence_id': occurrenceId,
      'comment_quick_reply_page_auth:token': authorisationNumber
    };
    $.post(
      indiciaData.ajaxFormPostQuickReplyPageAuth,
      data,
      function onPost(r) {
        if (typeof r.error !== 'undefined') {
          alert(r.error);
        }
      },
      'json'
    );
  }

  // Use an AJAX call to get the server to send the email
  function sendEmail(email) {
    $.post(
      indiciaData.esProxyAjaxUrl + '/verificationQueryEmail/' + indiciaData.nid,
      email,
      function (response) {
        if (response === 'OK') {
          $.fancybox.close();
          alert(indiciaData.lang.verificationButtons.emailSent);
        } else {
          $.fancybox.open('<div class="manual-email">' + indiciaData.lang.verificationButtons.requestManualEmail +
            '<div class="ui-helper-clearfix"><span class="left">To:</span><div class="right">' + email.to + '</div></div>' +
            '<div class="ui-helper-clearfix"><span class="left">Subject:</span><div class="right">' + email.subject + '</div></div>' +
            '<div class="ui-helper-clearfix"><span class="left">Content:</span><div class="right">' + email.body.replace(/\n/g, '<br/>') + '</div></div>' +
            '</div>');
        }
      }
    );
  }

  /*
   * Create a random authorisation number to pass to the Record Comment Quick Reply page
   * (This page sits outside the Warehouse)
   * @returns string random authorisation token
   */
  function makeAuthNumber() {
    var characterSelection = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var authNum = '';
    var digit;
    for (digit = 0; digit < 16; digit++) {
      authNum += characterSelection.charAt(Math.floor(Math.random() * characterSelection.length));
    }
    return authNum;
  }

  /**
   * Processes a query email (e.g. token replacements) then sends it.
   */
  function processEmail(e) {
    var email = {
      to: $('#email-to').val(),
      subject: $('#email-subject').val(),
      body: $('#email-body').val()
    };
    var popup = $(e.currentTarget).closest('.query-popup');
    var occurrenceId = $(popup).attr('data-id');
    var sampleId = $(popup).attr('data-sample-id');
    var urlSep = indiciaData.esProxyAjaxUrl.indexOf('?') === -1 ? '?' : '&';
    // Setup the quick reply page link and get an authorisation number.
    // Note: The quick reply page does actually support supplying a user_id parameter to it, however we don't do that in practice here as
    // we don't actually know if the user has an account (we would also have to collect the user_id for the entered email)
    var personIdentifierParam = '&email_address=' + email.to;
    // Need an authorisation unique string in URL, this is linked to the occurrence.
    // Only if correct auth and occurrence_id combination are present does the Record Comment Quick Reply page display
    var authorisationNumber = makeAuthNumber();
    var authorisationParam = '&auth=' + authorisationNumber;
    var commentQuickReplyPageLink = '<a href="' + indiciaData.warehouseUrl + 'occurrence_comment_quick_reply_page.php?occurrence_id=' +
        occurrenceId + personIdentifierParam + authorisationParam + '">' +
        indiciaData.lang.verificationButtons.commentReplyInstruct + '</a>';
    // Complete creation of email of record details
    if (emailFormvalidator.numberOfInvalids() === 0) {
      // Save info required for quick reply.
      saveAuthorisationNumberToDb(authorisationNumber, occurrenceId);
      // Replace the text tokens from the email with the actual text/link.
      email.body = email.body
        .replace('{{ emailReplyOption }}', indiciaData.lang.verificationButtons.emailReplyInstruct)
        .replace('{{ commentReplyOption }}', commentQuickReplyPageLink);
      // Ensure media and comments are loaded.
      $.ajax({
        url: indiciaData.esProxyAjaxUrl + '/mediaAndComments/' + indiciaData.nid + urlSep +
        'occurrence_id=' + occurrenceId + '&sample_id=' + sampleId,
        dataType: 'json',
        success: function handleResponse(response) {
          email.body = email.body.replace(/\{{ photos }}/g, response.media);
          email.body = email.body.replace(/\{{ comments }}/g, response.comments);
          // save a comment to indicate that the mail was sent
          saveVerifyComment([occurrenceId], { query: 'Q' }, indiciaData.lang.verificationButtons.emailLoggedAsComment, email);
          sendEmail(email);
        }
      });
    }
    return false;
  }

  /**
   * Submit handler for the redetermination popup form.
   */
  function redetFormSubmit(e) {
    var data;
    e.preventDefault();
    if ($('#redet-species').val() === '') {
      redetFormValidator.showErrors({ 'redet-species:taxon': 'Please type a few characters then choose a name from the list of suggestions' });
    } else if (redetFormValidator.numberOfInvalids() === 0) {
      $.fancybox.close();
      data = {
        website_id: indiciaData.website_id,
        'occurrence:id': occurrenceId,
        'occurrence:taxa_taxon_list_id': $('#redet-species').val(),
        user_id: indiciaData.user_id
      };
      if ($('#redet-comment').val()) {
        data['occurrence_comment:comment'] = $('#redet-comment').val();
      }
      $.post(
        indiciaData.ajaxFormPostRedet,
        data,
        function onResponse(response) {
          if (typeof response.error !== 'undefined') {
            alert(response.error);
          }
        }
      );
      // Now post update to Elasticsearch. Remove the website ID to temporarily disable the record.
      data = {
        ids: [occurrenceId],
        doc: {
          metadata: {
            website: {
              id: 0
            }
          }
        }
      };
      $.ajax({
        url: indiciaData.esProxyAjaxUrl + '/verifyids/' + indiciaData.nid,
        type: 'post',
        data: data,
        success: function success() {
          indiciaFns.hideItemAndMoveNext(listOutputControl[0]);
        }
      });
    }
  }

  /**
   * Enables shortcut keys for verification actions.
   *
   * @param DOM el
   *   Control element.
   */
  function enableKeyboardNavigation(el) {
    var statuses = {
      V: [1, 49],
      V1: [1, 49],
      V2: [2, 50],
      C3: [3, 51],
      R4: [4, 52],
      R: [5, 53],
      R5: [5, 53]
    };
    if (el.settings.keyboardNavigation) {
      // Add hints to indicate shortcut keys.
      $.each(statuses, function(code, key) {
        $('[data-status="' + code +'"]').attr('title', $('[data-status="' + code +'"]').attr('title') + ' (' + key[0] + ')');
        $('[data-status="' + code +'"]').attr('data-keycode', key[1]);
      });
      $('[data-query="Q"]').attr('title', $('[data-query="Q"]').attr('title') + ' (Q)');
      $('button.redet').attr('title', $('button.redet').attr('title') + ' (R)');
      // Keystroke handler for verification action shortcuts.
      $(document).keypress(function onKeypress(e) {
        // Abort if focus on an input control (as the event bubbles to the
        // container, or fancybox already visible).
        if ($(':input:focus').length || $.fancybox.getInstance()) {
          return true;
        }
        // Only interested in keys 1-5, q and d.
        if ($('[data-keycode="' + e.which +'"]:visible').length || e.which === 113 || e.which === 114) {
          if ($('[data-keycode="' + e.which +'"]:visible').length) {
            commentPopup({ status: $('[data-keycode="' + e.which +'"]:visible').attr('data-status') });
          } else if (e.which === 113) {
            queryPopup();
          } else if (e.which === 114) {
            $.fancybox.open($('#redet-form'));
          }
          e.preventDefault;
          return false;
        }
      });
    }
  }

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
      listOutputControl = $('#' + el.settings.showSelectedRow);
      listOutputControlClass = $(listOutputControl).hasClass('idc-output-cardGallery') ? 'idcCardGallery' : 'idcDataGrid';
      // Form validation for redetermination
      redetFormValidator = $('#redet-form').validate();
      // Plus setup redet form texts.
      if ($('.alt-taxon-list-message').length > 0) {
        $('.alt-taxon-list-message').html(
          $('.alt-taxon-list-message').html().replace('{message}', indiciaData.lang.verificationButtons.redetPartialListInfo)
        );
      }
      $(listOutputControl)[listOutputControlClass]('on', 'itemSelect', function itemSelect(tr) {
        var sep;
        var doc;
        var key;
        var keyParts;
        $('.external-record-link').remove();
        // Reset the redetermination form.
        $('#redet-form :input').val('');
        if (tr) {
          // Update the view and edit button hrefs. This allows the user to
          // right click and open in a new tab, rather than have an active
          // button.
          doc = JSON.parse($(tr).attr('data-doc-source'));
          occurrenceId = doc.id;
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
          // Ensure redets against same list as recorded taxon.
          $('#redet-species\\:taxon').setExtraParams({"taxon_list_id": doc.taxon.taxon_list.id});
          // If list used for search is not master list, then controls shown
          // to allow user to opt for master list instead.
          if (doc.taxon.taxon_list.id === indiciaData.mainTaxonListId) {
            $('.alt-taxon-list-controls').hide();
          }
          else {
            $('.alt-taxon-list-controls').show();
            $('#redet-from-full-list').prop('checked', false);
            indiciaData.selectedRecordTaxonListId = doc.taxon.taxon_list.id;
          }
        } else {
          $('.idc-verification-buttons').hide();
        }
      });
      $(listOutputControl)[listOutputControlClass]('on', 'populate', function populate() {
        $('.idc-verification-buttons').hide();
      });
      // Redet form use main taxon list checkbox.
      $('#redet-from-full-list').change(function(e) {
        if ($(e.currentTarget).prop('checked')) {
          $('#redet-species\\:taxon').setExtraParams({ taxon_list_id: indiciaData.mainTaxonListId });
        } else {
          $('#redet-species\\:taxon').setExtraParams({ taxon_list_id: indiciaData.selectedRecordTaxonListId });
        }
      });
      $(el).find('button.verify').click(function buttonClick(e) {
        var status = $(e.currentTarget).attr('data-status');
        commentPopup({ status: status });
      });
      $(el).find('button.query').click(function buttonClick() {
        queryPopup();
      });
      // If we have an upload decisions spreadsheet button, set it up.
      if ($(el).find('button.upload-decisions').length) {
        // Click handler.
        $(el).find('button.upload-decisions').click(function buttonClick() {
          uploadDecisions();
        });
        // Move to correct parent.
        if (el.settings.uploadButtonContainerElement) {
          $(el.settings.uploadButtonContainerElement).append($(el).find('button.upload-decisions'));
        }
      }
      $(el).find('button.redet').click(function expandRedet() {
        $.fancybox.open($('#redet-form'));
      });
      indiciaFns.on('click', '#cancel-redet', {}, function expandRedet() {
        $.fancybox.close();
      });
      enableKeyboardNavigation(el);
      $('#redet-form').submit(redetFormSubmit);
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
        var div = $(e.currentTarget).closest('.idc-verification-buttons-row');
        if ($(e.currentTarget).hasClass('fa-toggle-on')) {
          $(e.currentTarget).removeClass('fa-toggle-on');
          $(e.currentTarget).addClass('fa-toggle-off');
          div.find('.l2').hide();
          div.find('.l1').show();
        } else {
          $(e.currentTarget).removeClass('fa-toggle-off');
          $(e.currentTarget).addClass('fa-toggle-on');
          div.find('.l1').hide();
          div.find('.l2').show();
        }
      });
      // Toggle the apply to selected|table mode buttons.
      $(el).find('.apply-to button').click(function modeClick(e) {
        var div = $(e.currentTarget).closest('.idc-verification-buttons-row');
        div.find('.apply-to button').not(e.currentTarget).removeClass('active');
        $(e.currentTarget).addClass('active');
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
    var result;
    $.each(this, function callOnEachOutput() {
      if (methods[methodOrOptions]) {
        // Call a declared method.
        result = methods[methodOrOptions].apply(this, Array.prototype.slice.call(passedArgs, 1));
        return true;
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init".
        return methods.init.apply(this, passedArgs);
      }
      // If we get here, the wrong method was called.
      $.error('Method ' + methodOrOptions + ' does not exist on jQuery.idcVerificationButtons');
      return true;
    });
    // If the method has no explicit response, return this to allow chaining.
    return typeof result === 'undefined' ? this : result;
  };
}());

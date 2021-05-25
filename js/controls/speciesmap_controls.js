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
 * @package Client
 * @subpackage PrebuiltForms
 * @author  Indicia Team
 * @license http://www.gnu.org/licenses/gpl.html GPL 3.0
 * @link    http://code.google.com/p/indicia/
 */

var control_speciesmap_addcontrols;

(function ($) {
  control_speciesmap_addcontrols = function (options) {
    // The ftrsSubSampleLayer array tracks the features in the sub-sample.
    // This is required because feature clustering on OpenLayers 2 only
    // works correctly when all features are added to a layer together.
    // Therefore every time a feature is added or removed, all the features
    // must be removed and then added again to the clustered layer.
    var ftrsSubSampleLayer = [];
    var addSubSampleFtr = function(ftr) {
      ftrsSubSampleLayer.push(ftr);
      indiciaData.SubSampleLayer.removeAllFeatures();
      indiciaData.SubSampleLayer.addFeatures(ftrsSubSampleLayer);
      setClusteringOn(true);
    }
    var removeSubSampleFtr = function(ftr) {
      ftrsSubSampleLayer = ftrsSubSampleLayer.filter(function(f){
        return f.id !== ftr.id;
      })
      indiciaData.SubSampleLayer.removeAllFeatures();
      indiciaData.SubSampleLayer.addFeatures(ftrsSubSampleLayer);
      setClusteringOn(true);
    }
    var setClusteringOn = function (on) {
      if (on) {
        // Set threshold on cluster strategy to 2. That means single
        // features that are not within clustering distance of any others
        // are shown as original features - not clusters of 1 feature.
        indiciaData.SubSampleLayer.strategies[0].threshold = 2;
      } else {
        // Raise the threshold on cluster strategy which effectively removes it whilst
        // editing a specific subsample.
        indiciaData.SubSampleLayer.strategies[0].threshold = 10000;
      }
      // Recalculated clusters
      indiciaData.SubSampleLayer.strategies[0].clusters = null;
      indiciaData.SubSampleLayer.strategies[0].cluster();
    };
    var showButtons = function(buttons) {
      var all = ['add', 'mod', 'move', 'del', 'cancel', 'finish'];
      $.each(all, function (idx, button) {
        if ($.inArray(button, buttons) > -1) {
          $('#' + indiciaData.control_speciesmap_opts[this + 'ButtonId']).show();
        } else {
          $('#' + indiciaData.control_speciesmap_opts[this + 'ButtonId']).hide();
        }
      });
    };
    var fillInMainSref = function () {
      // get centre of bounds: this is in the map projection. Service Call will change that to internal as well as giving the sref.
      var div = $(indiciaData.control_speciesmap_opts.mapDiv)[0];
      var extent = indiciaData.SubSampleLayer.getDataExtent();
      var formatter = new OpenLayers.Format.WKT();
      var wkt;
      var centre;
      if (extent !== null) {
        centre = indiciaData.SubSampleLayer.getDataExtent().getCenterLonLat();
        wkt = formatter.extractGeometry(new OpenLayers.Geometry.Point(centre.lon, centre.lat));
        $.getJSON(indiciaData.control_speciesmap_opts.base_url + '/index.php/services/spatial/wkt_to_sref?wkt=' + wkt +
          '&system=' + $('[name="sample\:entered_sref_system"]').val() + '&wktsystem=' +
          div.map.projection.proj.srsProjNumber + '&precision=8&callback=?',
          function (data) {
            if (typeof data.error !== 'undefined') {
              alert(data.error);
            } else {
              $('[name="sample\:entered_sref"]').val(data.sref);
              $('[name="sample\:geom"]').val(data.wkt);
            }
          });
      }
      // TODO if map projection != indicia internal projection transform to internal projection
    };
    var showHideClonableRow = function  () {
      // If singleRecordSubsamples option is set on control, ensure that only a single
      // record can be created in a subsample by setting the visibility of the .scClonableRow
      // appropriately in the species grid.
      var clonableRow = $('#' + indiciaData.control_speciesmap_opts.id + ' .scClonableRow')
      if (opts.singleRecordSubsamples) {
        // Setting a timeout seems to be necessary because of asynchronous
        // update of species grid.
        setTimeout(function() {
          var subSampleRecords = $('#' + indiciaData.control_speciesmap_opts.id + ' > tbody > tr:visible').not('.scClonableRow');
          var preExistingDeleted = subSampleRecords.find('input.scPresence[type=checkbox]:not([checked])')
          if(subSampleRecords.length - preExistingDeleted.length > 0) {
            clonableRow.hide();
          } else {
            clonableRow.show();
          }
        }, 300);
      } else {
        clonableRow.show();
      }
    };
    var switchToSubSampleForm = function switchToSubSampleForm() {
      $(indiciaData.control_speciesmap_opts.mapDiv).hide(indiciaData.control_speciesmap_opts.animationDuration);
      $('#' + indiciaData.control_speciesmap_opts.id + '-cluster')
        .hide(indiciaData.control_speciesmap_opts.animationDuration);
      $('#' + indiciaData.control_speciesmap_opts.id + '-container')
        .show(indiciaData.control_speciesmap_opts.animationDuration, function after() {
          // Trigger footable resize so visible columns are updated.
          $('#' + indiciaData.control_speciesmap_opts.id + '-container table').trigger('footable_resize');
        });
      // Hide tab navigation buttons as they are confusing in this state.
      $('.wizard-buttons').hide();
      showHideClonableRow();
    };
    var switchToOverviewMap = function switchToOverviewMap() {
      $('#' + indiciaData.control_speciesmap_opts.id + '-container')
        .hide(indiciaData.control_speciesmap_opts.animationDuration);
      $('#' + indiciaData.control_speciesmap_opts.id + '-cluster')
        .hide(indiciaData.control_speciesmap_opts.animationDuration);
      $(indiciaData.control_speciesmap_opts.mapDiv)
        .show(indiciaData.control_speciesmap_opts.animationDuration, function after() {
          // Trigger map resize to ensure redraws correctly.
          var div = $(indiciaData.control_speciesmap_opts.mapDiv)[0];
          if (div.map) {
            div.map.updateSize();
          }
        });
      // Show tab navigation buttons that we previously hid.
      $('.wizard-buttons').show();
    };
    var switchToClusterSelect = function switchToClusterSelect(a1) {
      var currentMsg = $('#' + indiciaData.control_speciesmap_opts.messageId).text();
      $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(indiciaData.lang.speciesMap.ClusterMessage);
      indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
      $('#' + indiciaData.control_speciesmap_opts.id + '-cluster').empty();
      // Cancel button for the cluster sub-sample selecte
      var $cancel = $('<input type="button" value="' + indiciaData.lang.speciesMap.CancelLabel + '" /><br/>');
      $cancel.click(function(){
        setClusteringOn(true);
        switchToOverviewMap();
      });
      $('#' + indiciaData.control_speciesmap_opts.id + '-cluster').append($cancel);
      // Buttons for sub-sample select
      a1.feature.cluster.forEach(function(f){
        var $input = $('<input type="button" value="' + getSubSampleLabel(f, "; ") + '"/><br/>');
        $input.click(function(){
          $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(currentMsg);
          if (indiciaData.control_speciesmap_mode === 'Modify') {
            switchToSubSampleForm();
          } else {
            switchToOverviewMap();
          }
          clusterFeatureSelected(f.id);
        });
        $('#' + indiciaData.control_speciesmap_opts.id + '-cluster').append($input);
      });
      // Clustering must be turned of for feature move etc
      setClusteringOn(false);
      // Hide map, show cluster selection controls
      $(indiciaData.control_speciesmap_opts.mapDiv)
        .hide(indiciaData.control_speciesmap_opts.animationDuration);
      $('#' + indiciaData.control_speciesmap_opts.id + '-cluster')
        .show(indiciaData.control_speciesmap_opts.animationDuration);
      // Hide tab navigation buttons as they are confusing in this state.
      $('.wizard-buttons').hide();
    };
    var beginMove = function () {
      var div = $(indiciaData.control_speciesmap_opts.mapDiv)[0];
      indiciaData.control_speciesmap_selectFeatureControl.deactivate();
      // deacivating the control still leaves the selected feature highlighted.
      div.map.editLayer.clickControl.activate(); // to allow user to select new position.
      $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(indiciaData.lang.speciesMap.MoveMessage2);
      showButtons(['move', 'cancel']);
    };
    var endMove = function () {
      var div = $(indiciaData.control_speciesmap_opts.mapDiv)[0];
      var block = $('#scm-' + indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex + '-block');
      div.map.editLayer.destroyFeatures();
      div.map.editLayer.clickControl.deactivate(); // to allow user to select new position.
      indiciaData.control_speciesmap_selectFeatureControl.activate();
      indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
      indiciaData.control_speciesmap_new_feature.attributes.subSampleIndex = indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex;
      indiciaData.control_speciesmap_new_feature.attributes.count = indiciaData.control_speciesmap_existing_feature.attributes.count;
      indiciaData.control_speciesmap_new_feature.attributes.sRef = $('#imp-sref').val();
      indiciaData.control_speciesmap_new_feature.style = null; // needed so picks up style from new layer, including label
      removeSubSampleFtr(indiciaData.control_speciesmap_existing_feature);
      addSubSampleFtr(indiciaData.control_speciesmap_new_feature);
      fillInMainSref();
      block.find('[name$="\:entered_sref"]').val($('#imp-sref').val());
      block.find('[name$="\:geom"]').val($('#imp-geom').val());
      $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(indiciaData.lang.speciesMap.MoveMessage1);
      showButtons(['add', 'mod', 'move', 'del']);
      indiciaData.control_speciesmap_existing_feature = null;
      indiciaData.control_speciesmap_new_feature = null;
    };
    var doAddSref = function () {
      var div = $(indiciaData.control_speciesmap_opts.mapDiv)[0];
      var subsampleBlock;
      var gridIdx;
      var sampleControlsDiv;
      div.map.editLayer.destroyFeatures();
      indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id]++;
      indiciaData.control_speciesmap_new_feature.attributes.subSampleIndex =
        indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id];
      indiciaData.control_speciesmap_new_feature.attributes.sRef = $('#imp-sref').val();
      indiciaData.control_speciesmap_new_feature.attributes.count = 0;
      indiciaData.control_speciesmap_new_feature.style = null;
      addSubSampleFtr(indiciaData.control_speciesmap_new_feature);
      fillInMainSref();
      switchToSubSampleForm();
      $('#' + indiciaData.control_speciesmap_opts.id + '-container').find('.new').removeClass('new');
      $('#' + indiciaData.control_speciesmap_opts.id + '-blocks').find(' > div').hide();
      $('#' + indiciaData.control_speciesmap_opts.id + ' > tbody > tr').not('.scClonableRow').hide();
      $('#' + indiciaData.control_speciesmap_opts.id + ' .scClonableRow').find('[name$="\:sampleIDX"]').each(
        function (idx, field) {
          $(field).val(indiciaData.control_speciesmap_new_feature.attributes.subSampleIndex);
        }
      );
      subsampleBlock = $('<div class="new added scm-block" id="scm-' + indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id] + '-block"></div>')
        .appendTo('#' + indiciaData.control_speciesmap_opts.id + '-blocks');
      $('<label>' + indiciaData.lang.speciesMap.SRefLabel + ':</label> ').appendTo(subsampleBlock);
      $('<input type="text" name="sc:' + indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id] + '::sample:entered_sref" readonly="readonly" value="' + $('#imp-sref').val() + '" />')
        .appendTo(subsampleBlock);
      $('<input type="hidden" name="sc:' + indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id] + '::sample:geom" value="' + $('#imp-geom').val() + '" />')
        .appendTo(subsampleBlock);
      if (options.subSampleSampleMethodID) {
        $('<input type="hidden" name="sc:' + indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id] +
          '::sample:sample_method_id" value="' + options.subSampleSampleMethodID + '" />')
          .appendTo(subsampleBlock);
      }
      // new rows have no deleted field
      $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(indiciaData.lang.speciesMap.AddDataMessage);
      $('#' + indiciaData.control_speciesmap_opts.buttonsId).each(function () {window.scroll(0, $(this).offset().top); });
      showButtons(['cancel', 'finish']);
      gridIdx = indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id];
      if (typeof indiciaData.control_speciesmap_opts.sampleMethodId !== "undefined" && indiciaData.control_speciesmap_opts.sampleMethodId !== '') {
        $('<input type="hidden" name="sc:' + indiciaData['gridSampleCounter-' + indiciaData.control_speciesmap_opts.id] + '::sample:sample_method_id" value="' + indiciaData.control_speciesmap_opts.sampleMethodId + '" />')
          .appendTo(subsampleBlock);
        sampleControlsDiv = $('#' + indiciaData.control_speciesmap_opts.id + '-subsample-ctrls').clone(true, true).appendTo(subsampleBlock).show();
        // correct the IDs on the cloned block of sample controls
        $.each(sampleControlsDiv.find('*'), function(idx, elem) {
          if ($(elem).attr('id')) {
            $(elem).attr('id', $(elem).attr('id').replace(/^sc:n::/, 'sc:' + gridIdx + '::'));
            $(elem).attr('id', $(elem).attr('id').replace(/sc-n--/, 'sc-' + gridIdx + '--'));
          }
          if ($(elem).attr('name')) {
            $(elem).attr('name', $(elem).attr('name').replace(/^sc:n::/, 'sc:' + gridIdx + '::'));
          }
          if ($(elem).attr('for')) {
            $(elem).attr('for', $(elem).attr('for').replace(/^sc:n::/, 'sc:' + gridIdx + '::'));
          }
        });
      }
    };
    var featureAdded = function (a1) { // on editLayer
      if (a1.feature.attributes.type !== 'clickPoint' ) { return true; }
      indiciaData.control_speciesmap_new_feature = a1.feature.clone();
      switch (indiciaData.control_speciesmap_mode) {
        case 'Add':
          doAddSref();
          break;
        case 'Move':
          endMove();
          break;
      }
    };

    // feature from cluster selected
    var clusterFeatureSelected = function (id) {
      for(var i = 0; i < indiciaData.SubSampleLayer.features.length; i++) {
        if (indiciaData.SubSampleLayer.features[i].id === id) {
          var ftr = indiciaData.SubSampleLayer.features[i];
          break;
        }
      }
      indiciaData.control_speciesmap_selectFeatureControl.select(ftr);
      featureSelected({feature: ftr});
    }
    // feature selected on subSample layer
    var featureSelected = function (a1) {
      if (!a1.feature.attributes.subSampleIndex) {
        switchToClusterSelect(a1);
        return;
      }
      var block = $('#scm-' + a1.feature.attributes.subSampleIndex + '-block');
      var rowsToShow;
      indiciaData.control_speciesmap_existing_feature = a1.feature; /* not clone */
      switch (indiciaData.control_speciesmap_mode) {
        case 'Modify':
          switchToSubSampleForm();
          $('#' + indiciaData.control_speciesmap_opts.id + '-container').find('.new').removeClass('new');
          $('#' + indiciaData.control_speciesmap_opts.id + '-blocks > div').hide();
          $('#' + indiciaData.control_speciesmap_opts.id + ' > tbody > tr').not('.scClonableRow').hide();
          block.show();
          rowsToShow = $("[name$='\:sampleIDX']").filter('[value=' +
              indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex + ']').closest('tr');
          rowsToShow.show();
          rowsToShow.next('.supplementary-row').show();
          $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(
              indiciaData.lang.speciesMap.ModifyMessage2);
          showButtons(['finish']);
          $('#' + indiciaData.control_speciesmap_opts.id + ' .scClonableRow').find("[name$='\:sampleIDX']").each(
            function (idx, field) {
              $(field).val(indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex);
            }
          );
          break;
        case 'Move':
          beginMove();
          break;
        case 'Delete':
          $.fancyDialog({
            title: null,
            message: indiciaData.lang.speciesMap.ConfirmDeleteText.replace('{OLD}', a1.feature.attributes.sRef),
            okButton: indiciaData.lang.speciesMap.Yes,
            cancelButton: indiciaData.lang.speciesMap.No,
            callbackOk: function () {
              var block = $('#scm-' + indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex + '-block');
              // If the indicia sample id for the grid already exists, then have to flag as deleted, otherwise just wipe it.
              if (block.hasClass('added')) {
                block.remove();
              } else {
                block.find("[name$='\:sample\:deleted']").val('t').removeAttr('disabled');
                block.hide();
              }
              indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
              $("[name$='\:sampleIDX']").filter('[value=' + indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex + ']').closest('tr').not('.scClonableRow').remove();
              setupSummaryRows(indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex);
              removeSubSampleFtr(indiciaData.control_speciesmap_existing_feature);
              fillInMainSref();
            },
            callbackCancel: function () {
              indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
              setClusteringOn(true);
            }
          });
          break;
      }
      return true;
    };
    var setupSummaryRows = function (sampleIDX) {
      var elements = $('.control_speciesmapsummary').find('th:visible').length;
      var block = $('#scm-' + sampleIDX + '-block');
      var rows = $('[name$="\:sampleIDX"]').filter('[value=' + sampleIDX + ']').closest('tr').not('.scClonableRow');
      if ($('.control_speciesmapsummary').length === 0) {
        return;
      }
      $('.scm-summary-' + sampleIDX).remove();
      if (block.length > 0 && rows.length > 0) {
        $('.control_speciesmapsummary tbody').append('<tr class="scm-summary-' + sampleIDX + '"><td colspan=' +
          elements + '><span>' + indiciaData.lang.speciesMap.SRefLabel + ': ' +
          block.find("[name$='\:sample\:entered_sref']").val() + '</td></tr>');
      }
      rows.each(function (idx, elem) {
        var cloned = $(elem).clone();
        cloned.addClass('scm-summary-' + sampleIDX).find('*').removeAttr('id');
        cloned.find('td').filter('[class=""],.scSampleCell,.scPresenceCell').remove();
        cloned.find('.deh-required').remove();
        cloned.find('input[type=hidden]').each(function (idx, elem) {
          $(elem).remove();
        });
        cloned.find('input:text').each(function (idx, elem) {
          $(elem).after('<span>' + $(elem).val() + '</span>').remove();
        });
        cloned.find('input:checkbox').each(function (idx, elem) {
          if ($(elem).filter(':checked').length > 0) {
              $(elem).after('<span>' + indiciaData.lang.speciesMap.Yes + '</span>').remove();
          } else {
              $(elem).after('<span>' + indiciaData.lang.speciesMap.No + '</span>').remove();
          }
        });
        cloned.find('select').each(function () {
          var text = $('#' + indiciaData.control_speciesmap_opts.id).find('[name=' + $(this).attr('name')
              .replace(':', '\:') + ']').val();
          $(this).val(text);
          text = $(this).find('option:selected');
          if (text.length > 0) {
            text = text[0].text;
            $(this).after('<span>' + text + '</span>').remove();
          } else {
            $(this).remove();
          }
        });
        cloned.find('input:radio').each(function () {
          var label = '';
          if ($(this).filter(':checked').length > 0) {
            $(this).parent().find('label').each(function (i, elem) {
              label += elem.innerHTML;
            });
            $(this).parent().after('<span>' + label + '</span>').remove();
          } else {
            $(this).parent().remove(); // removes span - includes label.
          }
        });
        cloned.find('input,label').each(function (idx, elem) {
          $(elem).remove();
        });
        $('.control_speciesmapsummary tbody').append(cloned);
      });
    };
    var activate = function (me, mode, message) {
      var div = $(indiciaData.control_speciesmap_opts.mapDiv)[0];
      var feature;
      var scinputs;
      // first check validation state on species grid
      feature = (indiciaData.control_speciesmap_mode === 'Add' ?
          indiciaData.control_speciesmap_new_feature : indiciaData.control_speciesmap_existing_feature);
      if (typeof feature !== 'undefined' && feature !== null) {
        scinputs = $('[name$="\:sampleIDX"]').filter('[value=' + feature.attributes.subSampleIndex + ']')
            .closest('tr')
            .filter(':visible')
            .not('.scClonableRow')
            .find('input,select')
            .not(':disabled');
        if (typeof scinputs.valid !== 'undefined' && scinputs.length > 0 && !scinputs.valid()) {
          return; // validation failed: leave everything as was
        }
        setupSummaryRows(feature.attributes.subSampleIndex);
      }
      // next deactivate current state
      $('#' + indiciaData.control_speciesmap_opts.buttonsId).find('.ui-state-highlight')
        .removeClass('ui-state-highlight');
      indiciaData.control_speciesmap_existing_feature = null;
      indiciaData.control_speciesmap_new_feature = null;
      // Switches off add button functionality - note this equivalent of 'Finishing'
      div.map.editLayer.clickControl.deactivate();
      div.map.editLayer.destroyFeatures();
      $('#imp-sref,#imp-geom').val('');
      switchToOverviewMap();
      $('#' + indiciaData.control_speciesmap_opts.id + '-container').removeClass('new')
      showButtons(['add', 'mod', 'move', 'del']);
      // Switch off Move button functionality
      indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
      indiciaData.control_speciesmap_selectFeatureControl.deactivate();
      // Switch off Delete button functionality
      // select feature is switched off above by Move code
      $.fancybox.close();
      // highlight button and display message.
      $(me).addClass('ui-state-highlight');
      $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(message);
      switch (mode) {
        case 'Add':
          div.map.editLayer.clickControl.activate();
          break;
        case 'Move':
          indiciaData.control_speciesmap_selectFeatureControl.activate();
          break;
        case 'Modify':
        case 'Delete':
          indiciaData.control_speciesmap_selectFeatureControl.activate();
          break;
      }
      $('#imp-sref,#imp-geom').val('');
      // don't fire map events on the sref hidden control, otherwise the map zooms in
      $('#imp-sref').unbind('change');
      indiciaData.control_speciesmap_mode = mode;
      // In case user has activated a control from a context where clustering disabled
      // (e.g. selecting from a cluster)
      setClusteringOn(true);
    };
    var controlSpeciesmapAddbutton = function () {
      activate(this, 'Add', indiciaData.lang.speciesMap.AddMessage);
    };
    var controlSpeciesmapModifybutton = function () {
      activate(this, 'Modify', indiciaData.lang.speciesMap.ModifyMessage1);
    };
    var controlSpeciesmapMovebutton = function () {
      activate(this, 'Move', indiciaData.lang.speciesMap.MoveMessage1);
    };
    var controlSpeciesmapDeletebutton = function () {
      activate(this, 'Delete', indiciaData.lang.speciesMap.DeleteMessage);
    };
    var controlSpeciesmapCancelbutton = function () {
      var div = $(indiciaData.control_speciesmap_opts.mapDiv)[0];
      switch (indiciaData.control_speciesmap_mode) {
        case 'Add':
          switchToOverviewMap();
          $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(
              indiciaData.lang.speciesMap.AddMessage);
          showButtons(['add', 'mod', 'move', 'del']);
          indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
          $('#scm-' + indiciaData.control_speciesmap_new_feature.attributes.subSampleIndex + '-block').remove();
          $('[name$="\:sampleIDX"]')
            .filter('[value=' + indiciaData.control_speciesmap_new_feature.attributes.subSampleIndex + ']')
            .closest('tr').not('.scClonableRow')
            .remove();
          setupSummaryRows(indiciaData.control_speciesmap_new_feature.attributes.subSampleIndex);
          removeSubSampleFtr(indiciaData.control_speciesmap_new_feature);
          fillInMainSref();
          break;
        case 'Move':
          div.map.editLayer.clickControl.deactivate(); // to allow user to select new position.
          indiciaData.control_speciesmap_selectFeatureControl.activate();
          indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
          $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(
              indiciaData.lang.speciesMap.MoveMessage1);
          showButtons(['add', 'mod', 'move', 'del']);
          div.map.editLayer.destroyFeatures();
          $('#imp-sref,#imp-geom').val('');
          indiciaData.control_speciesmap_existing_feature = null;
          setClusteringOn(true);
          break;
      }
    };
    var controlSpeciesmapFinishbutton = function () {
      // first check that any filled in species grid rows pass validation.
      var feature = (indiciaData.control_speciesmap_mode === 'Add' ?
            indiciaData.control_speciesmap_new_feature : indiciaData.control_speciesmap_existing_feature);
      var scinputs;
      scinputs = $("[name$='\:sampleIDX']").filter('[value=' + feature.attributes.subSampleIndex + ']').closest('tr')
        .not('.scClonableRow')
        .find('input,select')
        .not(':disabled');
      if (typeof scinputs.valid !== "undefined" && scinputs.length > 0 && !scinputs.valid()) {
        return; // validation failed: leave everything in sight
      }
      setupSummaryRows(feature.attributes.subSampleIndex);
      switchToOverviewMap();
      $('#' + indiciaData.control_speciesmap_opts.id + '-container').find('.new').removeClass('new');
      switch (indiciaData.control_speciesmap_mode) {
        case 'Add':
          $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(indiciaData.lang.speciesMap.AddMessage);
          break;
        case 'Modify':
          $('#' + indiciaData.control_speciesmap_opts.messageId).empty().append(indiciaData.lang.speciesMap.ModifyMessage1);
          indiciaData.control_speciesmap_selectFeatureControl.unselectAll();
          break;
      }
      showButtons(['add', 'mod', 'move', 'del']);
      setClusteringOn(true);
    };

    var defaults = {
      mapDiv: '#map',
      panelClasses: 'ui-widget-header ui-corner-tl ui-corner-tr',
      buttonsId: 'speciesmap_controls',
      addButtonId: 'speciesmap_addbutton_control',
      modButtonId: 'speciesmap_modbutton_control',
      moveButtonId: 'speciesmap_movebutton_control',
      delButtonId: 'speciesmap_delbutton_control',
      cancelButtonId: 'speciesmap_cancelbutton_control',
      finishButtonId: 'speciesmap_finishbutton_control',
      messageId: 'speciesmap_controls_messages',
      messageClasses: '',
      animationDuration: 1000
    };
    var getSubSampleLabel = function(feature, separator) {
      if (indiciaData.speciesInLabel) {
        var $rowsToShow = $("[name$='\:sampleIDX']").filter('[value=' + feature.attributes.subSampleIndex + ']').closest('tr');
        var $cell = $rowsToShow.find('.scTaxonCell');
        var commonName = $($cell[0]).find('.taxon-name').text();
        var scientificName = $($cell[0]).find('em').text();
        labelSpecies = commonName ? commonName : scientificName;
        if (feature.attributes.count > 1) {
          var labelSpecies = labelSpecies + " +" + (feature.attributes.count-1);
        }
      } else {
        var labelSpecies = 'Species: ' + feature.attributes.count;
      }
      return 'Grid: ' + feature.attributes.sRef + separator + labelSpecies;
    }
    var opts;
    var container;
    // Extend our default options with those provided, basing this on an empty object
    // so the defaults don't get changed.
    opts = $.extend({}, defaults, options);
    indiciaData.control_speciesmap_opts = opts;
    container = $('<div id="' + opts.buttonsId + '" class="' + opts.panelClasses + '">').insertBefore(opts.mapDiv);
    $('<button id="' + opts.addButtonId + '" class="' + indiciaData.btnClasses.default + '" type="button">' + indiciaData.lang.speciesMap.AddLabel +
        '</button>').click(controlSpeciesmapAddbutton).appendTo(container);
    $('<button id="' + opts.modButtonId + '" class="' + indiciaData.btnClasses.default + '" type="button">' + indiciaData.lang.speciesMap.ModifyLabel +
        '</button>').click(controlSpeciesmapModifybutton).appendTo(container);
    $('<button id="' + opts.moveButtonId + '" class="' + indiciaData.btnClasses.default + '" type="button">' + indiciaData.lang.speciesMap.MoveLabel +
        '</button>').click(controlSpeciesmapMovebutton).appendTo(container);
    $('<button id="' + opts.delButtonId + '" class="' + indiciaData.btnClasses.default + '" type="button">' + indiciaData.lang.speciesMap.DeleteLabel +
        '</button>').click(controlSpeciesmapDeletebutton).appendTo(container);
    $('<button id="' + opts.cancelButtonId + '" class="' + indiciaData.btnClasses.default + '" type="button">' + indiciaData.lang.speciesMap.CancelLabel +
        '</button>').click(controlSpeciesmapCancelbutton).appendTo(container).hide();
    $('<button id="' + opts.finishButtonId + '" class="' + indiciaData.btnClasses.default + '" type="button">' + indiciaData.lang.speciesMap.FinishLabel +
        '</button>').click(controlSpeciesmapFinishbutton).appendTo(container).hide();
    $('<div id="' + opts.messageId + '" class="' + opts.messageClasses + '"></div>').appendTo(container);
    indiciaData.control_speciesmap_mode = 'Off';

    // We are assuming that this the species map control is invoked after the
    mapInitialisationHooks.push(function (div) {
      var defaultStyle = $.extend(true, {}, div.map.editLayer.style);
      var selectStyle = { fillColor: 'Blue', fillOpacity: 0.3, strokeColor: 'Blue', strokeWidth: 2 };
      var parentStyle = { fillOpacity: 0, strokeColor: 'Red', strokeWidth: 2 };
      var cloned;
      var first;
      var rebuildFeatureLabel;
      if ('#' + div.id === opts.mapDiv) {
        defaultStyle.label = "${getLabel}";
        defaultStyle.labelOutlineColor = 'white';
        defaultStyle.labelOutlineWidth = 3;
        defaultStyle.labelYOffset = 18;
        var defaultStyleContext = {
          context: {
            getLabel: function(feature) {
              if (feature.attributes.sRef) {
                return getSubSampleLabel(feature, "\n");
              } else {
                return 'Cluster of ' + feature.attributes.count;
              }
            }
          }
        }
        indiciaData.SubSampleLayer = new OpenLayers.Layer.Vector('Subsample Points', {
          displayInLayerSwitcher: false,
          strategies: [new OpenLayers.Strategy.Cluster({distance: 20, threshold: 2})],
          styleMap: new OpenLayers.StyleMap({
            default: new OpenLayers.Style(defaultStyle, defaultStyleContext),
            select: new OpenLayers.Style(selectStyle)
          })
        });
        indiciaData.ParentSampleLayer = new OpenLayers.Layer.Vector('Parent sample', {
          displayInLayerSwitcher: true,
          styleMap: new OpenLayers.StyleMap({ 'default': new OpenLayers.Style(parentStyle) })
        });
        // note select inherits the label from default
        div.map.addLayer(indiciaData.SubSampleLayer);
        div.map.addLayer(indiciaData.ParentSampleLayer);
        if (div.map.editLayer.features.length > 0) {
          first = div.map.editLayer.features;
          div.map.editLayer.removeFeatures(first);
          first[0].style = null;
          indiciaData.ParentSampleLayer.addFeatures(first);
        }
        indiciaData.control_speciesmap_selectFeatureControl =
            new OpenLayers.Control.SelectFeature(indiciaData.SubSampleLayer);
        div.map.addControl(indiciaData.control_speciesmap_selectFeatureControl);
        indiciaData.control_speciesmap_selectFeatureControl.deactivate();
        div.map.editLayer.clickControl.deactivate();
        indiciaData.SubSampleLayer.events.on({featureselected: featureSelected});
        div.map.editLayer.events.on({featureadded: featureAdded});
        cloned = $('#' + indiciaData.control_speciesmap_opts.id + ' > thead > tr').clone();
        cloned.find('th').eq(0).removeAttr('colspan');
        // remove the filter button
        cloned.find('th button').remove();
        $('.control_speciesmapsummary thead').append(cloned);
        // now add existing features.
        $('.scm-block').each(function (idx, block) {
          var id = $(block).attr('id').split('-');
          var parser = new OpenLayers.Format.WKT();
          var feature;
          feature = parser.read($(block).find('[name$="sample\:geom"]').val()); // style is null
          if (!div.indiciaProjection.equals(div.map.projection)) {
            feature.geometry.transform(div.indiciaProjection, div.map.projection);
          }
          feature.attributes.subSampleIndex = id[1];
          feature.attributes.sRef = $(block).find('[name$="sample\:entered_sref"]').val();
          feature.attributes.count = $('[name$="\:sampleIDX"]')
              .filter('[value=' + feature.attributes.subSampleIndex + ']').closest('tr').not('.scClonableRow').length;
          addSubSampleFtr(feature);
          setupSummaryRows(feature.attributes.subSampleIndex);
        });
        if (indiciaData.SubSampleLayer.features.length > 0) {
          indiciaData.SubSampleLayer.map.zoomToExtent(indiciaData.SubSampleLayer.getDataExtent());
        } else if (indiciaData.ParentSampleLayer.features.length > 0) {
          indiciaData.ParentSampleLayer.map.zoomToExtent(indiciaData.ParentSampleLayer.getDataExtent());
        }
        rebuildFeatureLabel = function() {
          var feature = (indiciaData.control_speciesmap_mode === 'Add' ?
              indiciaData.control_speciesmap_new_feature : indiciaData.control_speciesmap_existing_feature);
          // need to remove then re-add feature to rebuild label
          removeSubSampleFtr(feature);
          feature.attributes.count = $('[name$="\:sampleIDX"]')
              .filter('[value=' + feature.attributes.subSampleIndex + ']').closest('tr').not('.scClonableRow').length;
          feature.style = null;
          addSubSampleFtr(feature);
        };
        window.hook_species_checklist_delete_row.push(rebuildFeatureLabel);
        window.hook_species_checklist_delete_row.push(showHideClonableRow);
        window.hook_species_checklist_new_row.push(showHideClonableRow);
        window.hook_species_checklist_new_row.push(rebuildFeatureLabel);
        window.hook_species_checklist_new_row.push(function () {
          var feature = (indiciaData.control_speciesmap_mode === 'Add' ?
              indiciaData.control_speciesmap_new_feature : indiciaData.control_speciesmap_existing_feature);
          setupSummaryRows(feature.attributes.subSampleIndex);
        });
        // set the initial mode to add grid refs
        $('#' + opts.addButtonId).click();
      }
    });
  };
}(jQuery));

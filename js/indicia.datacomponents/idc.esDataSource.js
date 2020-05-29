/**
 * @file
 * Data source component for linking controls to Elasticsearch.
 *
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

/* eslint no-underscore-dangle: ["error", { "allow": ["_idfield", "_count", "_rows"] }] */

var IdcEsDataSource;

(function enclose() {
  'use strict';
  var $ = jQuery;

  /**
   * Constructor for an IdcEsDataSource.
   *
   * @param object settings
   *   Datasource settings.
   */
  IdcEsDataSource = function dataSource(providedSettings) {
    /**
     * Track the last request so we avoid duplicate requests.
     */
    var lastRequestStr = '';

    /**
     * Track the last count request so we avoid duplicate requests.
     */
    var lastCountRequestStr = '';

    /**
     * A list of additional setup functions depending on the mode.
     * */
    var modeSpecificSetupFns = {};

    /**
     * List of tabs that this source is due to populate on activation of.
     */
    var boundToTabs = [];

    /**
     * Some generic preparation for modes that aggregate data.
     */
    function prepareAggregationMode() {
      var settings = this.settings;
      var countingRequest;
      // Include the unique field in the list of fields request even if not specified.
      if ($.inArray(settings.uniqueField, settings.fields) === -1) {
        settings.fields.unshift(settings.uniqueField);
      }
      // Output aggregated, so size applies to agg not the docs list.
      settings.aggregationSize = settings.aggregationSize || settings.size || 10000;
      settings.size = 0;
      // Capture supplied aggregation so we can rebuild each time.
      settings.suppliedAggregation = settings.suppliedAggregation || settings.aggregation;
      settings.aggregation = settings.suppliedAggregation;
      // Work out if the request required to count the data has changed.
      countingRequest = indiciaFns.getFormQueryData(this, true);
      settings.needsRecount = JSON.stringify(countingRequest) !== lastCountRequestStr;
      lastCountRequestStr = JSON.stringify(countingRequest);
    }

    /**
     * Adds an entry from the @fields configuration to sources.
     *
     * Provides correct structure for the sources required for a composite
     * aggregation request. Includes converting attr_value special fields to
     * a painless script.
     */
    function addFieldToCompositeSources(compositeSources, field, sortDir) {
      var matches = field.match(/^#([^:]+)(:([^:]+):([^:]+))?#$/);
      var fieldObj;
      var srcObj = {};
      // Is this field a custom attribute definition?
      if (matches) {
        if (matches[1] === 'attr_value') {
          // Tolerate event or sample.
          matches[3] = matches[3] === 'sample' ? 'event' : matches[3];
          fieldObj = {
            script: {
              source: 'String r = \'\'; if (params._source.' + matches[3] + '.attributes != null) { ' +
                'for ( item in params._source.event.attributes ) { ' +
                  'if (item.id == \'' + matches[4] + '\') { r = item.value; } ' +
                '} ' +
              '} return r;',
              lang: 'painless'
            }
          };
        }
      } else {
        // Normal field.
        fieldObj = {
          field: indiciaFns.esFieldWithKeywordSuffix(field),
          missing_bucket: true
        };
      }
      if (fieldObj) {
        if (sortDir) {
          fieldObj.order = sortDir;
        }
        srcObj[field.asCompositeKeyName()] = { terms: fieldObj };
        compositeSources.push(srcObj);
      }
    }

    /** Private methods for specific setup for each source mode. */

    /**
     * Auto-build the composite aggregation if this mode enabled.
     */
    modeSpecificSetupFns.initCompositeAggregation = function initCompositeAggregation() {
      var subAggs = {};
      var sortInfo = indiciaFns.expandSpecialFieldSortInfo(this.settings.sort);
      var settings = this.settings;
      var compositeSources = [];
      var uniqueFieldWithSuffix = indiciaFns.esFieldWithKeywordSuffix(settings.uniqueField);
      prepareAggregationMode.call(this);
      // Capture supplied aggregation so we can rebuild each time.
      settings.suppliedAggregation = settings.suppliedAggregation || settings.aggregation;
      settings.aggregation = settings.suppliedAggregation;
      // Convert the fields list to the sources format required for composite agg.
      // Sorted fields must go first.
      $.each(sortInfo, function eachSortField(field, sortDir) {
        if ($.inArray(field, settings.fields) > -1) {
          addFieldToCompositeSources(compositeSources, field, sortDir);
        }
      });
      // Now add the rest of the unsorted fields.
      $.each(settings.fields, function eachField() {
        // Only the ones we haven't already added to sort on.
        if ($.inArray(this, Object.keys(sortInfo)) === -1) {
          addFieldToCompositeSources(compositeSources, this);
        }
      });
      // Add the additional aggs for the aggregations requested in config.
      $.each(settings.suppliedAggregation, function eachAgg(name) {
        subAggs[name] = this;
      });
      // @todo optimise - only recount if filter changed.
      settings.aggregation = {
        _rows: {
          composite: {
            size: settings.aggregationSize,
            sources: compositeSources
          },
          aggs: subAggs
        }
      };
      // Add a count agg only if filter changed.
      if (this.settings.needsRecount) {
        settings.aggregation._count = {
          cardinality: {
            field: uniqueFieldWithSuffix
          }
        };
      }
    };

    /**
     * Auto-build the term aggregation if this mode enabled.
     */
    modeSpecificSetupFns.initTermAggregation = function initTermAggregation() {
      var subAggs;
      var sortInfo = indiciaFns.expandSpecialFieldSortInfo(this.settings.sort);
      // Term aggregation sorts by single field only.
      var sortField = Object.keys(sortInfo)[0];
      var sortDir = sortInfo[sortField];
      var settings = this.settings;
      var uniqueFieldWithSuffix = indiciaFns.esFieldWithKeywordSuffix(settings.uniqueField);
      var termSources = [];
      prepareAggregationMode.call(this);
      // Convert list of fields to one suitable for top_hits _source.
      $.each(this.settings.fields, function eachField() {
        var matches = this.match(/^#([^:]+)(:([^:]+):([^:]+))?#$/);
        var type;
        var sources;
        if (matches && matches[1] === 'attr_value') {
          type = matches[3] === 'sample' ? 'event' : matches[3];
          sources = [type + '.attributes'];
        } else {
          sources = [this];
        }
        // Build unique list.
        termSources = termSources.concat(sources.filter(function filter(item) {
          return termSources.indexOf(item) < 0;
        }));
      });
      // List of sub-aggregations within the outer terms agg for the unique field must
      // always contain a top_hits agg to retrieve field values.
      subAggs = {
        fieldlist: {
          top_hits: {
            size: 1,
            _source: {
              includes: termSources
            }
          }
        }
      };
      // Add the additional aggs for the aggregations requested in config.
      $.each(settings.suppliedAggregation, function eachAgg(name) {
        subAggs[name] = this;
        if (name === sortField && settings.sortAggregation &&
            settings.sortAggregation[sortField]) {
          // Aggregation has a different aggregation to simplify the sort
          // e.g. where agg is costly.
          sortField = 'orderby_' + name;
          subAggs[sortField] = settings.sortAggregation[name];
        }
      });
      if ($.inArray(sortField, settings.fields) > -1) {
        // Sorting by a standard field.
        if (sortField === settings.uniqueField) {
          // Using the outer agg to sort, so simple use of _key.
          sortField = '_key';
        } else {
          // Using another field to sort, so add an aggregation to get a single
          // bucket value which we can sort on.
          subAggs.sortfield = {
            max: {
              field: sortField
            }
          };
          sortField = 'sortfield';
        }
      } else {
        // Sorting by a named aggregation. Special case - sort by _count not doc_count.
        sortField = sortField === 'doc_count' ? '_count' : sortField;
      }
      // Create the final aggregation object for the request.
      // @todo optimise - only recount if filter changed.
      settings.aggregation = {
        _idfield: {
          terms: {
            size: settings.aggregationSize,
            field: uniqueFieldWithSuffix,
            order: {
              // Will be filled in.
            }
          },
          aggs: subAggs
        }
      };
      settings.aggregation._idfield.terms.order[sortField] = sortDir;
      // Add a count agg only if filter changed.
      if (this.settings.needsRecount) {
        settings.aggregation._count = {
          cardinality: {
            field: uniqueFieldWithSuffix
          }
        };
      }
    };

    /** Private methods **/

    /**
     * Hides spinners for all outputs associated with this source.
     *
     * @param IdcEsDataSource source
     *   Source object to hide spinners for.
     */
    function hideAllSpinners() {
      var source = this;
      $.each(indiciaData.outputPluginClasses, function eachPluginClass(i, pluginClass) {
        $.each(source.outputs[pluginClass], function eachOutput() {
          $(this).find('.loading-spinner').hide();
        });
      });
    }

    /**
     * AJAX success handler for the population call.
     */
    function handlePopulationResponse(url, request, response, force, onlyForControl) {
      var source = this;
      if (response.error || (response.code && response.code !== 200)) {
        hideAllSpinners.call(this);
        alert('Elasticsearch query failed');
      } else {
        // Convert hits.total to Elasticsearch 7 style.
        if (response.hits.total && indiciaData.esVersion === 6) {
          response.hits.total = { value: response.hits.total, relation: 'eq' };
        }
        $.each(indiciaData.outputPluginClasses, function eachPluginClass(i, pluginClass) {
          $.each(source.outputs[pluginClass], function eachOutput() {
            if (!onlyForControl || onlyForControl === this) {
              $(this)[pluginClass]('populate', source.settings, response, request);
            }
          });
        });
        hideAllSpinners.call(source);
      }
    }

    /**
     * Fetch data and populate appropriate output plugins.
     *
     * @param bool force
     *   Set to true to force even if request same as before.
     * @param obj onlyForControl
     *   jQuery plugin to populate into. If not supplied, all plugins linked to
     *   source are populated.
     */
    function doPopulation(force, onlyForControl) {
      var source = this;
      var request;
      var url;
      request = indiciaFns.getFormQueryData(source);
      // Pagination support for composite aggregations.
      if (source.settings.after_key) {
        indiciaFns.findValue(request, 'composite').after = source.settings.after_key;
      }
      // Don't repopulate if exactly the same request as already loaded.
      if (request && (JSON.stringify(request) !== lastRequestStr || force)) {
        lastRequestStr = JSON.stringify(request);
        url = indiciaData.esProxyAjaxUrl + '/searchbyparams/' + (indiciaData.nid || '0');
        // Pass through additional parameters to the request.
        if (source.settings.filterPath) {
          // Filter path allows limiting of content in the response.
          url += url.indexOf('?') === false ? '?' : '&';
          url += 'filter_path=' + source.settings.filterPath;
        }
        $.ajax({
          url: url,
          type: 'post',
          data: request,
          success: function onSuccess(response) {
            handlePopulationResponse.call(source, url, request, response, force, onlyForControl);
          },
          error: function error(jqXHR) {
            hideAllSpinners.call(source);
            if (jqXHR.readyState === 4) {
              // Don't bother if not done - i.e. error because user navigated away.
              alert('Elasticsearch query failed');
            }
          },
          dataType: 'json'
        });
      } else {
        hideAllSpinners.call(source);
      }
    }

    /** Public methods **/

    /**
     * Creates links between the source and the controls which use it.
     */
    IdcEsDataSource.prototype.hookup = function hookup() {
      var ds = this;
      // Prepare a structure to store the output plugins linked to this ds.
      ds.outputs = {};
      $.each(indiciaData.outputPluginClasses, function eachPluginClass() {
        ds.outputs[this] = [];
      });
      // Make a collection of the output controls linked to this data source.
      $.each($('.idc-output'), function eachOutput() {
        var el = this;
        if (el.settings.source && Object.prototype.hasOwnProperty.call(el.settings.source, ds.settings.id)) {
          $.each(indiciaData.outputPluginClasses, function eachPluginClass(i, pluginClass) {
            var controlName = pluginClass.replace(/^idc/, '');
            controlName = controlName.charAt(0).toLowerCase() + controlName.substr(1);
            if ($(el).hasClass('idc-output-' + controlName)) {
              ds.outputs[pluginClass].push(el);
            }
          });
        }
      });
      // If datasource mode for mapping, use the map to limit the bounds retrieved.
      if (ds.settings.mode.match(/^map/) && !ds.settings.filterBoundsUsingMap) {
        if (!ds.outputs.idcLeafletMap || ds.outputs.idcLeafletMap.length === 0) {
          throw new Error('Source ' + ds.settings.id + ' using a mapping mode without a linked map.');
        }
        ds.settings.filterBoundsUsingMap = ds.outputs.idcLeafletMap[0].id;
      }
      // Does this datasource get a filter setting from a selected row in any grid(s)?
      if (ds.settings.filterSourceGrid && ds.settings.filterSourceField && ds.settings.filterField) {
        // Hook up row select event handlers to filter the ds.
        $.each(ds.settings.filterSourceGrid, function eachGrid(idx) {
          $('#' + this).idcDataGrid('on', 'rowSelect', function onRowSelect(tr) {
            var thisDoc;
            if (tr) {
              thisDoc = JSON.parse($(tr).attr('data-doc-source'));
              ds.settings.rowFilterField = ds.settings.filterField[idx];
              ds.settings.rowFilterValue = indiciaFns.getValueForField(thisDoc, ds.settings.filterSourceField[idx]);
              ds.populate();
            }
          });
        });
      }
      // If limited to a map's bounds, redraw when the map is zoomed or panned.
      if (ds.settings.filterBoundsUsingMap) {
        $('#' + ds.settings.filterBoundsUsingMap).idcLeafletMap('on', 'moveend', function onMoveEnd() {
          ds.populate();
        });
      }
    };

    /**
     * Prepares the aggregations for this source if in an automatic aggregation mode.
     */
    IdcEsDataSource.prototype.prepare = function prepare(forceMode) {
      var mode = forceMode || this.settings.mode;
      // Call any special initialisation for this source mode.
      var initMethodFn = 'init' + mode.charAt(0).toUpperCase() + mode.slice(1);
      if (typeof modeSpecificSetupFns[initMethodFn] !== 'undefined') {
        modeSpecificSetupFns[initMethodFn].call(this);
      }
    };

    /**
     * Ensure next request includes a count.
     */
    IdcEsDataSource.prototype.forceRecount = function forceRecount() {
      lastCountRequestStr = '';
    };

    /**
     * Request a datasource to repopulate from current parameters.
     *
     * @param bool force
     *   Set to true to force even if request same as before.
     * @param obj onlyForControl
     *   jQuery plugin to populate into. If not supplied, all plugins linked to
     *   source are populated.
     */
    IdcEsDataSource.prototype.populate = function datasourcePopulate(force, onlyForControl) {
      var src = this;
      var needsPopulation = false;
      if (!src.outputs) {
        // Not initialised yet, so don't populate.
        return;
      }
      // Check we have an output other than the download plugin, which only
      // outputs when you click Download.
      $.each(indiciaData.outputPluginClasses, function eachPluginClass(i, pluginClass) {
        $.each(src.outputs[pluginClass], function eachOutput() {
          var output = this;
          var populateThis = $(output)[pluginClass]('getNeedsPopulation', src);
          if ($(output).parents('.ui-tabs-panel:hidden').length > 0) {
            // Don't bother if on a hidden tab.
            populateThis = false;
            $.each($(output).parents('.ui-tabs-panel:hidden'), function eachHiddenTab() {
              var tab = this;
              var tabSelectFn;
              var index;
              if ($.inArray(tab.id, boundToTabs) === -1) {
                tabSelectFn = function eachTabSet(e, tabInfo) {
                  if (tabInfo.newPanel[0] === tab) {
                    $(output).find('.loading-spinner').show();
                    src.prepare();
                    doPopulation.call(src, force, onlyForControl);
                    indiciaFns.unbindTabsActivate($(tab).closest('.ui-tabs'), tabSelectFn);
                    boundToTabs = boundToTabs.splice(index, $.inArray(tab.id, boundToTabs));
                  }
                };
                indiciaFns.bindTabsActivate($(tab).closest('.ui-tabs'), tabSelectFn);
                boundToTabs.push(tab.id);
              }
            });
          }
          needsPopulation = needsPopulation || populateThis;
          if (populateThis) {
            $(output).find('.loading-spinner').show();
          }
        });
      });
      if (needsPopulation) {
        src.prepare();
        doPopulation.call(src, force, onlyForControl);
      }
    };

    // idcEsDataSource initialisation code.
    this.settings = providedSettings;
    // Does this datasource get a filter setting from a selected row in any grid(s)?
    if (this.settings.filterSourceGrid && this.settings.filterSourceField && this.settings.filterField) {
      // Can be a single string or an array if several grids.
      if (typeof this.settings.filterSourceGrid === 'string') {
        this.settings.filterSourceGrid = [this.settings.filterSourceGrid];
      }
      if (typeof this.settings.filterSourceField === 'string') {
        this.settings.filterSourceField = [this.settings.filterSourceField];
      }
      if (typeof this.settings.filterField === 'string') {
        this.settings.filterField = [this.settings.filterField];
      }
    }
    // Validation.
    if (this.settings.aggregation) {
      $.each(this.settings.aggregation, function eachAggKey(key) {
        if (key.substr(0, 1) === '_') {
          throw new Error('Aggregation names starting with underscore are reserved: ' + key + '.');
        }
      });
    }
    return this;
  };
}());

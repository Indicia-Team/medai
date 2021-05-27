/**
 * @file
 * A data grid plugin.
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

 /* eslint no-underscore-dangle: ["error", { "allow": ["_id", "_source", "_count"] }] */
 /* eslint no-param-reassign: ["error", { "props": false }]*/

/**
 * Output plugin for data grids.
 */
(function idcDataGridPlugin() {
  'use strict';
  var $ = jQuery;

  /**
   * Place to store public methods.
   */
  var methods;

  /**
   * Declare default settings.
   */
  var defaults = {
    actions: [],
    aggregation: null,
    cookies: true,
    includeColumnHeadings: true,
    includeColumnSettingsTool: true,
    includeFilterRow: true,
    includeFullScreenTool: true,
    includePager: true,
    keyboardNavigation: false,
    sortable: true,
    responsive: true,
    responsiveOptions: {
      breakpoints: {
        xs: 480,
        sm: 768,
        md: 992,
        lg: 1200
      }
    },
    autoResponsiveCols: false,
    /**
     * Registered callbacks for different events.
     */
    callbacks: {
      itemSelect: [],
      itemDblClick: [],
      populate: []
    },
    // Page tracking for composite aggregations
    compositeInfo: {
      page: 0,
      pageAfterKeys: {}
    },
    totalRowCount: null
  };

  /**
   * Removes the configuration overlay pane.
   */
  function removeConfigPane(el) {
    var panel = $(el).find('.data-grid-settings');
    $(panel).fadeOut('fast');
    // Undo forced minimum height on the container.
    $(el).css('min-height', '');
  }

  function appendColumnsToConfigList(el, columns) {
    var done = [];
    var ol = $(el).find('.data-grid-settings ol');
    $.each(columns, function eachColumn() {
      var colInfo = el.settings.availableColumnInfo[this.field];
      var caption = colInfo.caption ? colInfo.caption : '<em>no heading</em>';
      var description = colInfo.description ? colInfo.description : '';
      done.push(this.field);
      $('<li>' +
        '<div class="checkbox">' +
        '<label><input type="checkbox" checked="checked" value="' + this.field + '">' + caption + '</label>' +
        '</div>' + description +
        '</li>').appendTo(ol);
    });
    $.each(el.settings.availableColumnInfo, function eachField(key, info) {
      if ($.inArray(key, done) === -1) {
        $('<li>' +
          '<div class="checkbox"><label><input type="checkbox" value="' + key + '">' + info.caption + '</label></div>' +
          (info.description ? info.description : '') +
          '</li>').appendTo(ol);
      }
    });
  }

  /**
   * Adds the header cells to the table header.
   */
  function addColumnHeadings(el, header) {
    var headerRow = $('<tr/>').appendTo(header);
    var breakpointsByIdx = [];
    var srcSettings = el.settings.sourceObject.settings;
    var aggInfo = srcSettings.aggregation;
    if (el.settings.autoResponsiveCols) {
      // Build list of breakpoints to use by column position.
      $.each(el.settings.responsiveOptions.breakpoints, function eachPoint(name, point) {
        var i;
        for (i = Math.round(point / 100); i < el.settings.columns.length; i++) {
          while (breakpointsByIdx.length < i + 1) {
            breakpointsByIdx.push([]);
          }
          breakpointsByIdx[i].push(name);
        }
      });
    }
    if (el.settings.responsive) {
      $('<th class="footable-toggle-col" data-sort-ignore="true"></th>').appendTo(headerRow);
    }
    $.each(el.settings.columns, function eachColumn(idx) {
      var colDef = el.settings.availableColumnInfo[this.field];
      var heading = colDef.caption;
      var footableExtras = '';
      var sortableField = false;
      // Tolerate hyphen or camelCase.
      var hideBreakpoints = colDef.hideBreakpoints || colDef['hide-breakpoints'];
      var dataType = colDef.dataType || colDef['data-type'];
      if (srcSettings.mode === 'docs') {
        // Either a standard field, or a special field which provides an
        // associated sort field.
        sortableField = (indiciaData.esMappings[this.field] && indiciaData.esMappings[this.field].sort_field) ||
          indiciaData.fieldConvertorSortFields[this.field.simpleFieldName()];
      } else if (srcSettings.mode === 'compositeAggregation') {
        // CompositeAggregation can sort on any field column, not aggregations.
        sortableField = !(aggInfo[this.field] || this.field === 'doc_count');
      } else if (srcSettings.mode === 'termAggregation') {
        // Term aggregations allow sort on the aggregation cols, or fields if
        // numeric or date, but not normal text fields.
        sortableField = aggInfo[this.field] || this.field === 'doc_count' ||
          (indiciaData.esMappings[this.field] && !indiciaData.esMappings[this.field].type.match(/^(text|keyword)$/));
      }
      if (el.settings.sortable !== false && sortableField) {
        heading += '<span class="sort fas fa-sort"></span>';
      }
      // Extra data attrs to support footable.
      if (el.settings.autoResponsiveCols) {
        footableExtras = ' data-hide="' + breakpointsByIdx[idx].join(',') + '"';
      } else if (hideBreakpoints) {
        footableExtras = ' data-hide="' + hideBreakpoints + '"';
      }
      if (dataType) {
        footableExtras += ' data-type="' + dataType + '"';
      }
      $('<th class="col-' + idx + '" data-field="' + this.field + '"' + footableExtras + '>' + heading + '</th>')
        .appendTo(headerRow);
    });
    if (el.settings.actions.length) {
      $('<th class="col-actions"></th>').appendTo(headerRow);
    }
    if (el.settings.scrollY) {
      // Spacer in header to allow for scrollbar in body.
      $('<th class="scroll-spacer"></th>').appendTo(headerRow);
    }
  }

  /**
   * Adds the filter row cells and inputs to the table header.
   */
  function addFilterRow(el, header) {
    var filterRow = $('<tr class="es-filter-row" />').appendTo(header);
    if (el.settings.responsive) {
      $('<td class="footable-toggle-col"></td>').appendTo(filterRow);
    }
    $.each(el.settings.columns, function eachColumn(idx) {
      var td = $('<td class="col-' + idx + '" data-field="' + this.field + '"></td>').appendTo(filterRow);
      var title;
      var caption = el.settings.availableColumnInfo[this.field].caption;
      // No filter input if this column has no mapping unless there is a
      // special field function that can work out the query.
      if (typeof indiciaData.esMappings[this.field] !== 'undefined'
          || typeof indiciaFns.fieldConvertorQueryBuilders[this.field.simpleFieldName()] !== 'undefined') {
        if (indiciaFns.fieldConvertorQueryBuilders[this.field.simpleFieldName()]) {
          if (indiciaFns.fieldConvertorQueryDescriptions[this.field.simpleFieldName()]) {
            title = indiciaFns.fieldConvertorQueryDescriptions[this.field.simpleFieldName()];
          } else {
            title = 'Enter a value to find matches in the ' + caption + ' column.';
          }
        } else if (indiciaData.esMappings[this.field].type === 'text' || indiciaData.esMappings[this.field].type === 'keyword') {
          title = 'Search for words in the ' + caption + ' column. Prefix with ! to exclude rows which contain words ' +
            'beginning with the text you enter. Use * at the end of words to find words starting with. Use ' +
            '&quot;&quot; to group words into phrases and | between words to request either/or searches. Use - ' +
            'before a word to exclude that word from the search results.';
        } else if (indiciaData.esMappings[this.field].type === 'date') {
          title = 'Search for dates in the ' + caption + ' column. Searches can be in the format yyyy, yyyy-yyyy, ' +
            'dd/mm/yyyy or dd/mm/yyyy hh:mm.';
        } else {
          title = 'Search for a number in the ' + caption + ' column. Prefix with ! to exclude rows which match the ' +
            'number you enter or separate a range with a hyphen (e.g. 123-456).';
        }
        $('<input type="text" title="' + title + '">').appendTo(td);
      }
    });
  }

  function applyColumnsList(el, colsList) {
    el.settings.columns = [];
    $.each(colsList, function eachCol() {
      if (el.settings.availableColumnInfo[this]) {
        el.settings.columns.push(el.settings.availableColumnInfo[this]);
      }
    });
  }

  /**
   * Apply settings that are dependent on the source's mode.
   */
  function applySourceModeSettings(el) {
    var sourceSettings = el.settings.sourceObject.settings;
    var pathsPerMode = {
      compositeAggregation: 'key',
      termAggregation: 'fieldlist.hits.hits.0._source'
    };
    if (sourceSettings.mode.match(/Aggregation$/)) {
      // Columns linked to aggregation's fields array need to have a path
      // in the response document defined.
      $.each(el.settings.availableColumnInfo, function eachCol(field, colDef) {
        // Everything not in the aggregations list must be a field.
        if (!sourceSettings.suppliedAggregation[field] && field !== 'doc_count') {
          colDef.path = pathsPerMode[sourceSettings.mode];
        }
      });
    }
  }

  /**
   * Calculate the correct tbody height on resize, if a fixed or anchored height.
   */
  function setTableHeight(el) {
    var tbody = $(el).find('tbody');
    var fullscreenOffset;
    if (el.settings.scrollY) {
      if (el.settings.scrollY.match(/^-/)) {
        // If fullscreen, treat full screen element as page top, so need to offset.
        fullscreenOffset = indiciaFns.fullscreenElement() ? $(indiciaFns.fullscreenElement()).offset().top : 0;
        tbody.css('max-height', fullscreenOffset + (($(window).height() + parseInt(el.settings.scrollY.replace('px', ''), 10))
          - ($(el).find('tbody').offset().top + $(el).find('tfoot').height())));
      } else {
        tbody.css('max-height', el.settings.scrollY);
      }
    }
  }

  /**
   * Assigns the classes required to show sort info icons in the header row.
   */
  function showHeaderSortInfo(sortButton, sortDesc) {
    var headingRow = $(sortButton).closest('tr');
    $(headingRow).find('.sort.fas').removeClass('fa-sort-down');
    $(headingRow).find('.sort.fas').removeClass('fa-sort-up');
    $(headingRow).find('.sort.fas').addClass('fa-sort');
    $(sortButton).removeClass('fa-sort');
    $(sortButton).addClass('fa-sort-' + (sortDesc ? 'down' : 'up'));
  }

  /**
   * Register the various user interface event handlers.
   */
  function initHandlers(el) {

    /**
     * Track loaded row ID to avoid duplicate effort.
     */
    var lastLoadedRowId = null;

    /**
     * SetTimeout handle so the row load timeout can be cleared when navigating quickly.
     */
    var loadRowTimeout;

    /**
     * Fire callbacks when a row has been selected
     * */
    function loadSelectedRow() {
      var tr = $('#' + el.id + ' .es-data-grid tbody tr.selected');
      if (tr.length && tr.data('row-id') !== lastLoadedRowId) {
        lastLoadedRowId = tr.data('row-id');
        $.each(el.settings.callbacks.itemSelect, function eachCallback() {
          this(tr);
        });
      }
    }

    /**
     * Row click handler.
     *
     * Adds selected class and fires callbacks.
     */
    indiciaFns.on('click', '#' + el.id + ' .es-data-grid tbody tr', {}, function onDataGridRowClick() {
      var tr = this;
      $(tr).closest('tbody').find('tr.selected').removeClass('selected');
      $(tr).addClass('selected');
      loadSelectedRow();
    });

    /**
     * Double click grid row handler.
     *
     * Adds selected class and fires callbacks.
     */
    indiciaFns.on('dblclick', '#' + el.id + ' .es-data-grid tbody tr', {}, function onDataGriditemDblClick() {
      var tr = this;
      if (!$(tr).hasClass('selected')) {
        $(tr).closest('tbody').find('tr.selected').removeClass('selected');
        $(tr).addClass('selected');
      }
      $.each(el.settings.callbacks.itemDblClick, function eachCallback() {
        this(tr);
      });
    });

    /**
     * Implement arrow key and other navigation tools.
     */
    if (el.settings.keyboardNavigation) {

      /**
       * Navigate when arrow key pressed.
       */
      function handleArrowKeyNavigation(keyCode, oldSelected) {
        var newSelected = keyCode === 38 ? $(oldSelected).prev('tr') : $(oldSelected).next('tr');
        if (newSelected.length) {
          $(newSelected).addClass('selected');
          $(newSelected).focus();
          $(oldSelected).removeClass('selected');
        }
        // Load row on timeout to avoid rapidly hitting services if repeat-hitting key.
        if (loadRowTimeout) {
          clearTimeout(loadRowTimeout);
        }
        loadRowTimeout = setTimeout(function() {
          loadSelectedRow();
        }, 500);
      }

      indiciaFns.on('keydown', 'body', {}, function onDataGridKeydown(e) {
        var oldSelected = $(el).find('tr.selected');
        if ($(':input:focus').length) {
          // Input focused, so the only keystroke we are interested in is
          // escape to close a Fancbox dialog.
          if (e.which === 27 && $.fancybox.getInstance()) {
            indiciaFns.closeFancyboxForSelectedItem();
          }
        } else if (e.which === 38 || e.which === 40) {
          handleArrowKeyNavigation(e.which, oldSelected);
          e.preventDefault();
          return false;
        } else if (e.which === 73) {
          // i key opens and closes image popups.
          if ($('.fancybox-image').length) {
            indiciaFns.closeFancyboxForSelectedItem();
          } else {
            var fbLink = oldSelected.find('[data-fancybox]');
            if (fbLink.length) {
              $(fbLink).click();
            }
          }
        }
      });
    }

    /**
     * Next page click.
     */
    $(el).find('.footer .next').click(function clickNext() {
      indiciaFns.movePage(el, true, 'tbody tr.data-row');
    });

    /**
     * Previous page click.
     */
    $(el).find('.footer .prev').click(function clickPrev() {
      indiciaFns.movePage(el, false, 'tbody tr.data-row');
    });

    /**
     * Rows per page change.
     */
    $(el).find('.rows-per-page select').change(function changeRowsPerPage() {
      indiciaFns.rowsPerPageChange(el);
    });

    /**
     * Sort column headers click handler.
     */
    indiciaFns.on('click', '#' + el.id + ' th', {}, function clickSort() {
      var $sortSpan = $(this).find('span.sort');
      var fieldName = $sortSpan.closest('th').attr('data-field');
      var sortDesc = $sortSpan.hasClass('fa-sort-up');
      var sourceObj = el.settings.sourceObject;
      if (fieldName) {
        showHeaderSortInfo($sortSpan, sortDesc);
        sourceObj.settings.sort = {};
        sourceObj.settings.sort[fieldName] = sortDesc ? 'desc' : 'asc';
        sourceObj.populate();
      }
    });

    /**
     * Filter row input change handler.
     */
    indiciaFns.on('change', '#' + el.id + ' .es-filter-row input', {}, function changeFilterInput() {
      var sources = Object.keys(el.settings.source);
      if (el.settings.applyFilterRowToSources) {
        sources = sources.concat(el.settings.applyFilterRowToSources);
      }
      $.each(sources, function eachSource() {
        var source = indiciaData.esSourceObjects[this];
        // Reset to first page.
        source.settings.from = 0;
        source.populate();
      });
    });

    /**
     * Multi-select switch toggle handler.
     */
    $(el).find('.multiselect-switch').click(function clickMultiselectSwitch() {
      var table = $(el).find('table');
      if ($(el).hasClass('multiselect-mode')) {
        $(el).removeClass('multiselect-mode');
        $(table).find('.multiselect-cell').remove();
        $('.selection-buttons-placeholder').append($('.all-selected-buttons'));
      } else {
        $(el).addClass('multiselect-mode');
        $(table).find('thead tr').prepend(
          '<th class="multiselect-cell" />'
        );
        $(table).find('thead tr:first-child th:first-child').append(
          '<input type="checkbox" class="multiselect-all" />'
        );
        $(table).find('tbody tr').prepend(
          '<td class="multiselect-cell"><input type="checkbox" class="multiselect" /></td>'
        );
        $(table).closest('div').prepend(
          $('.all-selected-buttons')
        );
      }
      setTableHeight(el);
    });

    /**
     * Select all checkboxes event handler.
     */
    indiciaFns.on('click', '#' + el.id + ' .multiselect-all', {}, function onClick(e) {
      $(e.currentTarget).closest('table')
        .find('.multiselect')
        .prop('checked', $(e.currentTarget).is(':checked'));
    });

    /**
     * Click handler for the settings icon. Displays the config overlay pane.
     */
    $(el).find('.data-grid-show-settings').click(function settingsIconClick() {
      var $panel = $(el).find('.data-grid-settings').html('');
      var ol;
      var maxHeight;
      // Ensure height available enough for columns config.
      $(el).css('min-height', '250px');
      $('<h3>Column configuration</h3>').appendTo($panel);
      $('<p>The following columns are available for this table. Tick the ones you want to include. Drag and drop the ' +
        'columns into your preferred order.</p>').appendTo($panel);
      $('<div><button class="btn btn-default toggle">Tick/untick all</button>' +
        '<button class="btn btn-default restore">Restore defaults</button> ' +
        '<button class="btn btn-default cancel">Cancel</button>' +
        '<button class="btn btn-primary save">Save</button></div>').appendTo($panel);
      ol = $('<ol/>').appendTo($panel);
      $panel.fadeIn('fast');
      maxHeight = $(el).find('table.es-data-grid').height() - ($(ol).offset().top - $panel.offset().top);
      $(ol).css('max-height', Math.max(400, maxHeight) + 'px');
      appendColumnsToConfigList(el, el.settings.columns);
      Sortable.create($panel.find('ol')[0]);
    });

    $(el).find('.fullscreen-tool').click(function fullscreenIconClick() {
      indiciaFns.goFullscreen(el);
    });

    /**
     * Config save button handler.
     */
    indiciaFns.on('click', '#' + el.id + ' .data-grid-settings .save', {}, function onClick() {
      var header = $(el).find('thead');
      var colsList = [];
      $.each($(el).find('.data-grid-settings ol :checkbox:checked'), function eachCheckedCol() {
        colsList.push($(this).val());
      });
      applyColumnsList(el, colsList);
      // Save columns in a cookie.
      if (el.settings.cookies) {
        $.cookie('cols-' + el.id, JSON.stringify(colsList), { expires: 3650 });
      }
      $(header).find('*').remove();
      // Output header row for column titles.
      if (el.settings.includeColumnHeadings !== false) {
        addColumnHeadings(el, header);
      }
      // Disable filter row for aggregations.
      el.settings.includeFilterRow =
        el.settings.includeFilterRow && !el.settings.sourceObject.settings.mode.match(/aggregation$/);
      // Output header row for filtering.
      if (el.settings.includeFilterRow !== false) {
        addFilterRow(el, header);
      }
      el.settings.sourceObject.populate(true);
      removeConfigPane(el);
    });

    /**
     * Config cancel button handler.
     */
    indiciaFns.on('click', '.data-grid-settings .cancel', {}, function onClick() {
      removeConfigPane(el);
    });

    /**
     * Config restore button handler.
     */
    indiciaFns.on('click', '.data-grid-settings .restore', {}, function onClick() {
      // Discard current columns and replace with defaults.
      $(el).find('.data-grid-settings ol li').remove();
      appendColumnsToConfigList(el, el.settings.defaultColumns);
    });

    /**
     * Config toggle button handler.
     */
    indiciaFns.on('click', '.data-grid-settings .toggle', {}, function onClick() {
      var anyUnchecked = $(el).find('.data-grid-settings ol li :checkbox:not(:checked)').length > 0;
      $(el).find('.data-grid-settings ol li :checkbox').prop('checked', anyUnchecked);
    });
  }

  /**
   * Find the data used to populate the table in the response.
   *
   * Data can be found in the response hits (i.e. standard occurrence
   * documents), the buckets of an aggregation, or a custom built source table.
   */
  function getSourceDataList(el, response) {
    if (el.settings.sourceObject.settings.aggregation) {
      // Aggregated data so use the buckets.
      return indiciaFns.findValue(response.aggregations, 'buckets');
    }
    // A standard list of records.
    return response.hits.hits;
  }

  function addHeader(el, table) {
    var header;
    // If we need any sort of header, add <thead>.
    if (el.settings.includeColumnHeadings !== false || el.settings.includeFilterRow !== false) {
      header = $('<thead/>').appendTo(table);
      // Output header row for column titles.
      if (el.settings.includeColumnHeadings !== false) {
        addColumnHeadings(el, header);
      }
      // Output header row for filtering.
      if (el.settings.includeFilterRow !== false) {
        addFilterRow(el, header);
      }
    }
  }

  /**
   * Return the <td> elements for special behaviours in a row.
   *
   * Includes row selection and responsive table toggle cells.
   */
  function getRowBehaviourCells(el) {
    var cells = [];
    if ($(el).hasClass('multiselect-mode')) {
      cells.push('<td class="multiselect-cell"><input type="checkbox" class="multiselect" /></td>');
    }
    if (el.settings.responsive) {
      cells.push('<td class="footable-toggle-col"></td>');
    }
    return cells;
  }

  /**
   * Return the <td> elements for data in a row.
   */
  function getDataCells(el, doc, maxCharsPerCol) {
    var cells = [];
    var sourceSettings = el.settings.sourceObject.settings;
    $.each(el.settings.columns, function eachColumn(idx) {
      var value;
      var rangeValue;
      var classes = ['col-' + idx];
      var style = '';
      var colDef = el.settings.availableColumnInfo[this.field];
      var date;
      // Extra space in last col to account for tool icons.
      var extraSpace = idx === el.settings.columns.length - 1 && !el.settings.actions.length ? 2 : 0;
      var charWidth;
      // In compositeAggregation mode, fields are replaced by key names. We replace
      // . with - to avoid confusion when iterating down paths.
      var field = sourceSettings.mode === 'compositeAggregation' && $.inArray(this.field, sourceSettings.fields) > -1
        ? this.field.asCompositeKeyName() : this.field;
      value = indiciaFns.getValueForField(doc, field, colDef);
      if (colDef.rangeField) {
        rangeValue = indiciaFns.getValueForField(doc, colDef.rangeField);
        if (value !== rangeValue) {
          value = value + ' to ' + rangeValue;
        }
      }
      if (value && colDef.handler && colDef.handler === 'date') {
        date = new Date(value);
        value = date.toLocaleDateString();
      } else if (value && colDef.handler && colDef.handler === 'datetime') {
        date = new Date(value);
        value = date.toLocaleString();
      }
      if (value && typeof value === 'string' && value.match(/class="(single|multi)"/)) {
        // Thumbnail(s) so give approx column size.
        charWidth = value.match(/class="single"/) ? 8 : 14;
        maxCharsPerCol['col-' + idx] = Math.max(maxCharsPerCol['col-' + idx], extraSpace + charWidth);
      } else {
        maxCharsPerCol['col-' + idx] =
          Math.max(maxCharsPerCol['col-' + idx], longestWordLength($('<p>' + value + '</p>').text()) + extraSpace);
      }
      classes.push('field-' + this.field.replace(/\./g, '--').replace(/_/g, '-'));
      // Copy across responsive hidden cols.
      if ($(el).find('table th.col-' + idx).css('display') === 'none') {
        style = ' style="display: none"';
      }
      value = value === null ? '' : value;
      if (colDef.ifEmpty && value === '') {
        value = colDef.ifEmpty;
      }
      cells.push('<td class="' + classes.join(' ') + '"' + style + '>' + value + '</td>');
      return true;
    });
    return cells;
  }

  /**
   * After population of the table, fire callbacks.
   *
   * Callbacks may be linked to the populate event or the itemSelect event if
   * the selected row changes.
   */
  function fireAfterPopulationCallbacks(el) {
    // Fire any population callbacks.
    $.each(el.settings.callbacks.populate, function eachCallback() {
      this(el);
    });
    // Fire callbacks for selected row if any.
    $.each(el.settings.callbacks.itemSelect, function eachCallback() {
      this($(el).find('tr.selected').length === 0 ? null : $(el).find('tr.selected')[0]);
    });
  }

  /**
   * Column resizing needs to be done manually when tbody has scroll bar.
   *
   * Tbody can only have scroll bar if not it's normal CSS display setting, so
   * we lose col auto-resizing. This sets col widths according to the max
   * amount of data in each.
   */
  function setColWidths(el, maxCharsPerCol) {
    var maxCharsPerRow = 0;
    var tbody = $(el).find('tbody');
    var pixelsAvailable = tbody[0].clientWidth;
    var scrollbarWidth = tbody[0].offsetWidth - tbody[0].clientWidth;
    var scrollBarInnerWidth;
    var outerSpacing = $(el).find('.col-0').outerWidth() - $(el).find('.col-0').width();
    // Column resizing needs to be done manually when tbody has scroll bar.
    if (el.settings.scrollY) {
      if (el.settings.responsive) {
        // Allow 14px space for responsive show + button.
        $(el).find('.footable-toggle-col').css('width', '14px');
        pixelsAvailable -= $(el).find('.footable-toggle-col').outerWidth();
      }
      if (el.settings.actions.length > 0) {
        // Allow 22px space for actions column.
        $(el).find('.col-actions').css('width', '22px');
        pixelsAvailable -= $(el).find('.col-actions').outerWidth();
      } else {
        $(el).find('.col-actions').css('width', 0);
      }
      // Space header if a scroll bar visible.
      if (tbody.find('tr').length > 0 && scrollbarWidth > 0) {
        scrollBarInnerWidth = scrollbarWidth - outerSpacing;
        $(el).find('.scroll-spacer').css('width', scrollBarInnerWidth + 'px');
        pixelsAvailable -= $(el).find('.scroll-spacer').outerWidth();
      } else {
        $(el).find('.scroll-spacer').css('width', 0);
      }
      $.each(el.settings.columns, function eachColumn(idx) {
        // Allow extra char per col for padding.
        maxCharsPerCol['col-' + idx] += 1;
        maxCharsPerRow += maxCharsPerCol['col-' + idx];
      });
      $.each(el.settings.columns, function eachColumn(idx) {
        $(el).find('.col-' + idx).css('width', (pixelsAvailable * (maxCharsPerCol['col-' + idx] / maxCharsPerRow) - outerSpacing) + 'px');
      });
    }
  }

  /**
   * Finds the longest word in a string.
   */
  function longestWordLength(str) {
    var strSplit = str.split(' ');
    var longestWord = 0;
    var i;
    for (i = 0; i < strSplit.length; i++) {
      if (strSplit[i].length > longestWord) {
        longestWord = strSplit[i].length;
      }
    }
    return longestWord;
  }

  function buildColDef(field, agg) {
    var colDef = {
      field: field,
      caption: field.asReadableKeyName()
    };
    var aggField;
    if (indiciaData.esMappings[field] && indiciaData.esMappings[field].type === 'date') {
      colDef.handler = 'date';
    } else if (agg) {
      aggField = indiciaFns.findValue(agg, 'field');
      if (aggField && indiciaData.esMappings[aggField] && indiciaData.esMappings[aggField].type === 'date') {
        colDef.handler = 'date';
      }
    }
    return colDef;
  }

  /**
   * Column setup.
   *
   * * Applies default list of columns if not specified.
   * * Defines the list of available columns for selection.
   */
  function setupColumnInfo(el) {
    var srcSettings = el.settings.sourceObject.settings;
    if (!el.settings.columns) {
      el.settings.columns = [];
      // In aggregation mode, defaults are the field list + aggs list.
      if (srcSettings.mode.match(/Aggregation$/)) {
        el.settings.columns.push(buildColDef(srcSettings.uniqueField));
        $.each(srcSettings.fields, function eachField() {
          if (this !== srcSettings.uniqueField) {
            el.settings.columns.push(buildColDef(this));
          }
        });
        $.each(srcSettings.aggregation, function eachAgg(key) {
          el.settings.columns.push(buildColDef(key, this));
        });
      } else {
        // Docs mode.
        el.settings.columns.push({
          field: 'taxon.accepted_name',
          caption: indiciaData.gridMappingFields['taxon.accepted_name'].caption
        });
        el.settings.columns.push({
          field: '#event_date#',
          caption: 'Date'
        });
        el.settings.columns.push({
          field: 'location.output_sref',
          caption: indiciaData.gridMappingFields['location.output_sref'].caption
        });
      }
    }
    el.settings.availableColumnInfo = {};
    // Keep the list of names in order.
    el.settings.availableColumnNames = [];
    // Specified columns must appear first.
    $.each(el.settings.columns, function eachCol() {
      el.settings.availableColumnInfo[this.field] = this;
      el.settings.availableColumnNames.push(this.field);
    });
    // Add other mappings if in docs mode, unless overridden by availableColumns
    // setting.
    if (srcSettings.mode === 'docs') {
      $.each(indiciaData.gridMappingFields, function eachMapping(key, obj) {
        var exist = el.settings.availableColumnInfo[key] || {};
        // Include unless not in configured list of available cols.
        if (!el.settings.availableColumns || $.inArray(key, el.settings.availableColumns) > -1) {
          el.settings.availableColumnInfo[key] = $.extend({}, obj, exist, { field: key });
          el.settings.availableColumnNames.push(key);
        }
      });
    }
  }

  /**
   * Declare public methods.
   */
  methods = {
    /**
     * Initialise the idcDataGrid plugin.
     *
     * @param array options
     */
    init: function init(options) {
      var el = this;
      var table;
      var totalCols;
      var footableSort;
      var tableClasses = ['table', 'es-data-grid'];
      var savedCols;
      var tools = [];

      indiciaFns.registerOutputPluginClass('idcDataGrid');
      el.settings = $.extend(true, {}, defaults);
      // Apply settings passed in the HTML data-* attribute.
      if (typeof $(el).attr('data-idc-config') !== 'undefined') {
        $.extend(el.settings, JSON.parse($(el).attr('data-idc-config')));
      }
      // Apply settings passed to the constructor.
      if (typeof options !== 'undefined') {
        $.extend(el.settings, options);
      }
      // dataGrid does not make use of multiple sources.
      el.settings.sourceObject = indiciaData.esSourceObjects[Object.keys(el.settings.source)[0]];
      // Disable cookies unless id specified.
      if (!el.id || !$.cookie) {
        el.settings.cookies = false;
      }
      setupColumnInfo(el);
      // Store original column settings.
      el.settings.defaultColumns = el.settings.columns.slice();
      // Load from cookie.
      if (el.settings.cookies) {
        savedCols = $.cookie('cols-' + el.id);
        // Don't recall cookie if empty, as this is unlikely to be deliberate.
        if (savedCols && savedCols !== '[]') {
          applyColumnsList(el, JSON.parse(savedCols));
        }
      }
      // Revert to default in case of broken cookie.
      if (el.settings.columns.length === 0) {
        el.settings.columns = el.settings.defaultColumns.slice();
      }
      footableSort = el.settings.sourceObject.settings.mode === 'compositeAggregation' && el.settings.sortable
        ? 'true' : 'false';
      if (el.settings.scrollY) {
        tableClasses.push('fixed-header');
      }
      // Disable filter row for aggregations.
      el.settings.includeFilterRow = el.settings.includeFilterRow && !el.settings.sourceObject.settings.mode.match(/Aggregation$/);
      // Build the elements required for the table.
      table = $('<table class="' + tableClasses.join(' ') + '" data-sort="' + footableSort + '" />').appendTo(el);
      addHeader(el, table);
      // We always want a table body for the data.
      $('<tbody />').appendTo(table);
      // Output a footer if we want a pager.
      if (el.settings.includePager) {
        totalCols = el.settings.columns.length
          + (el.settings.responsive ? 1 : 0)
          + (el.settings.actions.length > 0 ? 1 : 0);
        $('<tfoot><tr class="footer"><td colspan="' + totalCols + '">' + indiciaFns.getFooterControls(el) + '</td></tr></tfoot>').appendTo(table);
      }
      setTableHeight(el);
      // Add tool icons for table settings, full screen and multiselect mode.
      if (el.settings.includeMultiSelectTool) {
        tools.push('<span title="Enable multiple selection mode" class="fas fa-list multiselect-switch"></span>');
      }
      if (el.settings.includeColumnSettingsTool) {
        tools.push('<span class="fas fa-wrench data-grid-show-settings" title="Click to show grid column settings"></span>');
      }
      if (el.settings.includeFullScreenTool &&
          (document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled)) {
        tools.push('<span class="far fa-window-maximize fullscreen-tool" title="Click to view grid in full screen mode"></span>');
      }
      $('<div class="idc-output-tools">' + tools.join('<br/>') + '</div>').appendTo(el);
      // Add overlay for settings etc.
      $('<div class="data-grid-settings" style="display: none"></div>').appendTo(el);
      $('<div class="loading-spinner" style="display: none"><div>Loading...</div></div>').appendTo(el);
      initHandlers(el);
      if (footableSort === 'true' || el.settings.responsive) {
        // Make grid responsive.
        $(el).indiciaFootableReport(el.settings.responsiveOptions);
      }
      if (el.settings.responsive && el.settings.autoResponsiveExpand) {
        // Auto-expand the extra details row if cols hidden because below a
        // breakpoint.
        $(table).trigger('footable_expand_all');
        $(table).bind('footable_breakpoint', function onBreak() {
          $(table).trigger('footable_expand_all');
        });
      }
      window.addEventListener('resize', function resize() { setTableHeight(el); });
    },

    /**
     * Populate the data grid with Elasticsearch response data.
     *
     * @param obj sourceSettings
     *   Settings for the data source used to generate the response.
     * @param obj response
     *   Elasticsearch response data.
     * @param obj data
     *   Data sent in request.
     */
    populate: function populate(sourceSettings, response, data) {
      var el = this;
      var dataList = getSourceDataList(el, response);
      var maxCharsPerCol = {};
      var afterKey = indiciaFns.findValue(response, 'after_key');
      applySourceModeSettings(el);
      if (sourceSettings.mode === 'compositeAggregation' && !afterKey && el.settings.compositeInfo.page > 0) {
        // Moved past last page, so abort.
        $(el).find('.next').prop('disabled', true);
        el.settings.compositeInfo.page--;
        return;
      }
      // Cleanup before repopulating.
      $(el).find('tbody tr').remove();
      $(el).find('.multiselect-all').prop('checked', false);
      // In scrollY mode, we have to calculate the column widths ourselves
      // since putting CSS overflow on tbody requires us to lose table layout.
      // Start by finding the number of characters in header cells. Later we'll
      // increase this if  we find cells in a column that contain more
      // characters.
      $.each(el.settings.columns, function eachColumn(idx) {
        // Only use the longest word in the caption as we'd rather break the
        // heading than the data rows.
        maxCharsPerCol['col-' + idx] = Math.max(longestWordLength(el.settings.availableColumnInfo[this.field].caption), 3);
        if (typeof indiciaData.esMappings[this] !== 'undefined' && indiciaData.esMappings[this.field].sort_field) {
          // Add 2 chars to allow for the sort icon.
          maxCharsPerCol['col-' + idx] += 2;
        }
      });
      if (el.settings.actions.length === 0 && !el.settings.scrollY) {
        // If no scrollbar or actions column, 2 extra chars for the last
        // heading as it contains tool icons.
        maxCharsPerCol['col-' + (el.settings.columns.length - 1)] += 2;
      }
      $.each(dataList, function eachHit(i) {
        var hit = this;
        var cells = [];
        var row;
        var classes = ['data-row'];
        var doc = hit._source ? hit._source : hit;
        var dataRowIdAttr;
        // For keyboard navigation, need to enable row focus.
        var tabindexAttr = el.settings.keyboardNavigation ? 'tabindex="' + i + '" ' : '';
        cells = getRowBehaviourCells(el);
        cells = cells.concat(getDataCells(el, doc, maxCharsPerCol));
        if (el.settings.actions.length) {
          cells.push('<td class="col-actions">' + indiciaFns.getActions(el, el.settings.actions, doc) + '</td>');
        }
        if (el.settings.selectIdsOnNextLoad && $.inArray(hit._id, el.settings.selectIdsOnNextLoad) !== -1) {
          classes.push('selected');
        }
        // Automatically add class for zero abundance data so it can be struck
        // through.
        if (doc.occurrence && doc.occurrence.zero_abundance === 'true') {
          classes.push('zero-abundance');
        }
        if (el.settings.rowClasses) {
          $.each(el.settings.rowClasses, function eachClass() {
            classes.push(indiciaFns.applyFieldReplacements(el, doc, this));
          });
        }
        dataRowIdAttr = hit._id ? ' data-row-id="' + hit._id + '"' : '';
        row = $('<tr class="' + classes.join(' ') + '"' + tabindexAttr + dataRowIdAttr + '>'
           + cells.join('') +
           '</tr>').appendTo($(el).find('tbody'));
        $(row).attr('data-doc-source', JSON.stringify(doc));
        return true;
      });
      if (el.settings.responsive) {
        $(el).find('table').trigger('footable_redraw');
      }
      if (el.settings.sourceObject.settings.mode === 'docs') {
        el.settings.totalRowCount = response.hits.total.value;
      }
      indiciaFns.drawPagingFooter(el, response, data, 'tbody tr', afterKey);
      fireAfterPopulationCallbacks(el);
      setColWidths(el, maxCharsPerCol);
    },

    /**
     * Register an event handler.
     *
     * @param string event
     *   Event name.
     * @param function handler
     *   Callback function called on this event.
     */
    on: function on(event, handler) {
      if (typeof this.settings.callbacks[event] === 'undefined') {
        indiciaFns.controlFail(this, 'Invalid event handler requested for ' + event);
      }
      this.settings.callbacks[event].push(handler);
    },

    /**
     * Grids always populate when their source updates.
     */
    getNeedsPopulation: function getNeedsPopulation() {
      return true;
    }

  };

  /**
   * Extend jQuery to declare idcDataGrid plugin.
   */
  $.fn.idcDataGrid = function buildDataGrid(methodOrOptions) {
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
      $.error('Method ' + methodOrOptions + ' does not exist on jQuery.idcDataGrid');
      return true;
    });
    // If the method has no explicit response, return this to allow chaining.
    return typeof result === 'undefined' ? this : result;
  };
}());

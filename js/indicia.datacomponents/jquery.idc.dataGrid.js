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

 /* eslint no-underscore-dangle: ["error", { "allow": ["_id", "_source"] }] */
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
    includeFilterRow: true,
    includePager: true,
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
    /**
     * Registered callbacks for different events.
     */
    callbacks: {
      rowSelect: [],
      rowDblClick: [],
      populate: []
    },
    // Page tracking for composite aggregations
    compositeInfo: {
      page: 0,
      pageAfterKeys: {}
    }
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
      var colInfo = el.settings.availableColumnInfo[this];
      var caption = colInfo.caption ? colInfo.caption : '<em>no heading</em>';
      var description = colInfo.description ? colInfo.description : '';
      done.push(this);
      $('<li>' +
        '<div class="checkbox">' +
        '<label><input type="checkbox" checked="checked" value="' + this + '">' + caption + '</label>' +
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
    if (el.settings.responsive) {
      $('<th class="footable-toggle-col" data-sort-ignore="true"></th>').appendTo(headerRow);
    }
    $.each(el.settings.columns, function eachColumn(idx) {
      var colDef = el.settings.availableColumnInfo[this];
      var heading = colDef.caption;
      var footableExtras = '';
      var sortableField = typeof indiciaData.esMappings[this] !== 'undefined'
        && indiciaData.esMappings[this].sort_field;
      sortableField = sortableField
        || indiciaData.fieldConvertorSortFields[this.simpleFieldName()];
      if (el.settings.sortable !== false && sortableField) {
        heading += '<span class="sort fas fa-sort"></span>';
      }
      if (colDef.multiselect) {
        heading += '<span title="Enable multiple selection mode" class="fas fa-list multiselect-switch"></span>';
      }
      // Extra data attrs to support footable.
      if (colDef['hide-breakpoints']) {
        footableExtras = ' data-hide="' + colDef['hide-breakpoints'] + '"';
      }
      if (colDef['data-type']) {
        footableExtras += ' data-type="' + colDef['data-type'] + '"';
      }
      $('<th class="col-' + idx + '" data-field="' + this + '"' + footableExtras + '>' + heading + '</th>')
        .appendTo(headerRow);
    });
    if (el.settings.actions.length) {
      $('<th class="col-actions"></th>').appendTo(headerRow);
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
      var td = $('<td class="col-' + idx + '" data-field="' + this + '"></td>').appendTo(filterRow);
      var title;
      var caption = el.settings.availableColumnInfo[this].caption;
      // No filter input if this column has no mapping unless there is a
      // special field function that can work out the query.
      if (typeof indiciaData.esMappings[this] !== 'undefined'
          || typeof indiciaFns.fieldConvertorQueryBuilders[this.simpleFieldName()] !== 'undefined') {
        if (indiciaFns.fieldConvertorQueryBuilders[this.simpleFieldName()]) {
          if (indiciaFns.fieldConvertorQueryDescriptions[this.simpleFieldName()]) {
            title = indiciaFns.fieldConvertorQueryDescriptions[this.simpleFieldName()];
          } else {
            title = 'Enter a value to find matches the ' + caption + ' column.';
          }
        } else if (indiciaData.esMappings[this].type === 'text' || indiciaData.esMappings[this].type === 'keyword') {
          title = 'Search for words in the  which begin with this text in the ' + caption + ' column. Prefix with ! to exclude rows which contain words beginning with the text you enter.';
        } else {
          title = 'Search for a number in the ' + caption + ' column. Prefix with ! to exclude rows which match the number you enter or separate a range with a hyphen (e.g. 123-456).';
        }
        $('<input type="text" title="' + title + '">').appendTo(td);
      }
    });
  }

  function applyColumnsList(el, colsList) {
    el.settings.columns = [];
    $.each(colsList, function eachCol() {
      if (el.settings.availableColumnInfo[this]) {
        el.settings.columns.push(this);
      }
    });
  }

  function movePage(el, forward) {
    if (el.settings.aggregation === 'composite') {
      el.settings.compositeInfo.page += (forward ? 1 : -1);
    }
    $.each(el.settings.source, function eachSource(sourceId) {
      var source = indiciaData.esSourceObjects[sourceId];
      if (el.settings.aggregation === 'composite') {
        // Composite aggregations use after_key to find next page.
        if (el.settings.compositeInfo.pageAfterKeys[el.settings.compositeInfo.page]) {
          source.settings.after_key = el.settings.compositeInfo.pageAfterKeys[el.settings.compositeInfo.page];
        } else {
          delete source.settings.after_key;
        }
      } else {
        if (typeof source.settings.from === 'undefined') {
          source.settings.from = 0;
        }
        if (forward) {
          // Move to next page based on currently visible row count, in case some
          // have been removed.
          source.settings.from += $(el).find('tbody tr.data-row').length;
        } else {
          source.settings.from -= source.settings.size;
        }
        source.settings.from = Math.max(0, source.settings.from);
      }
      source.populate();
    });
  }

   /**
   * Register the various user interface event handlers.
   */
  function initHandlers(el) {
    indiciaFns.on('click', '#' + el.id + ' .es-data-grid tbody tr', {}, function onDataGridRowClick() {
      var tr = this;
      $(tr).closest('tbody').find('tr.selected').removeClass('selected');
      $(tr).addClass('selected');
      $.each(el.settings.callbacks.rowSelect, function eachCallback() {
        this(tr);
      });
    });

    indiciaFns.on('dblclick', '#' + el.id + ' .es-data-grid tbody tr', {}, function onDataGridRowDblClick() {
      var tr = this;
      if (!$(tr).hasClass('selected')) {
        $(tr).closest('tbody').find('tr.selected').removeClass('selected');
        $(tr).addClass('selected');
      }
      $.each(el.settings.callbacks.rowDblClick, function eachCallback() {
        this(tr);
      });
    });

    $(el).find('.pager .next').click(function clickNext() {
      movePage(el, true);
    });

    $(el).find('.pager .prev').click(function clickPrev() {
      movePage(el, false);
    });

    $(el).find('.sort').click(function clickSort() {
      var sortButton = this;
      var row = $(sortButton).closest('tr');
      $.each(el.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        var field = $(sortButton).closest('th').attr('data-field');
        var sortDesc = $(sortButton).hasClass('fa-sort-up');
        var sortData;
        var fieldName = field.simpleFieldName();
        $(row).find('.sort.fas').removeClass('fa-sort-down');
        $(row).find('.sort.fas').removeClass('fa-sort-up');
        $(row).find('.sort.fas').addClass('fa-sort');
        $(sortButton).removeClass('fa-sort');
        $(sortButton).addClass('fa-sort-' + (sortDesc ? 'down' : 'up'));
        source.settings.sort = {};
        if (indiciaData.esMappings[fieldName]) {
          source.settings.sort[indiciaData.esMappings[fieldName].sort_field] = {
            order: sortDesc ? 'desc' : 'asc'
          };
        } else if (indiciaData.fieldConvertorSortFields[fieldName]) {
          sortData = indiciaData.fieldConvertorSortFields[fieldName];
          if ($.isArray(sortData)) {
            $.each(sortData, function eachField() {
              source.settings.sort[this] = {
                order: sortDesc ? 'desc' : 'asc'
              };
            });
          } else if (typeof sortData === 'object') {
            source.settings.sort = sortData;
            indiciaFns.findAndSetValue(source.settings.sort, 'order', sortDesc ? 'desc' : 'asc');
          }
        }
        source.populate();
      });
    });

    $(el).find('.es-filter-row input').change(function changeFilterInput() {
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

    $(el).find('.multiselect-switch').click(function clickMultiselectSwitch() {
      var table = $(this).closest('table');
      if ($(table).hasClass('multiselect-mode')) {
        $(table).removeClass('multiselect-mode');
        $(table).find('.multiselect-cell').remove();
        $('.selection-buttons-placeholder').append($('.all-selected-buttons'));
      } else {
        $(table).addClass('multiselect-mode');
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
      $panel.find('ol').sortable();
    });

    function onFullScreenChange() {
      var tbody;
      var fsEl = document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement;
      tbody = $(el).find('tbody');
      if (tbody && el.settings.scrollY) {
        if (fsEl === el) {
          // @todo Set max height according to full screen size.
          tbody.css('max-height', '');
        } else {
          tbody.css('max-height', el.settings.scrollY + 'px');
        }
      }
    }

    document.addEventListener('fullscreenchange', onFullScreenChange);

    /* Firefox */
    document.addEventListener('mozfullscreenchange', onFullScreenChange);

    /* Chrome, Safari and Opera */
    document.addEventListener('webkitfullscreenchange', onFullScreenChange);

    /* IE / Edge */
    document.addEventListener('msfullscreenchange', onFullScreenChange);

    $(el).find('.data-grid-fullscreen').click(function settingsIconClick() {
      if (document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      } else if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    });

    /**
     * Config save button handler.
     */
    indiciaFns.on('click', '.data-grid-settings .save', {}, function onClick() {
      var header = $(el).find('thead');
      var showingAggregation = el.settings.aggregation || el.settings.sourceTable;
      var colsList = [];
      $.each($(el).find('.data-grid-settings ol :checkbox:checked'), function eachCheckedCol() {
        colsList.push($(this).val());
      });
      applyColumnsList(el, colsList);
      // Save columns in a cookie.
      if (el.settings.cookies && $.cookie) {
        $.cookie('cols-' + el.id, JSON.stringify(colsList));
      }
      $(header).find('*').remove();
      // Output header row for column titles.
      if (el.settings.includeColumnHeadings !== false) {
        addColumnHeadings(el, header);
      }
      // Disable filter row for aggregations.
      el.settings.includeFilterRow = el.settings.includeFilterRow && !showingAggregation;
      // Output header row for filtering.
      if (el.settings.includeFilterRow !== false) {
        addFilterRow(el, header);
      }
      $.each(el.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        source.populate(true);
      });
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
   * Retrieve any action links to attach to an idcDataGrid row.
   *
   * @param array actions
   *   List of actions from configuration.
   * @param object doc
   *   The ES document for the row.
   *
   * @return string
   *   Action link HTML.
   */
  function getActionsForRow(actions, doc) {
    var html = '';
    $.each(actions, function eachActions() {
      var item;
      var link;
      if (typeof this.title === 'undefined') {
        html += '<span class="fas fa-times-circle error" title="Invalid action definition - missing title"></span>';
      } else {
        if (this.iconClass) {
          item = '<span class="' + this.iconClass + '" title="' + this.title + '"></span>';
        } else {
          item = this.title;
        }
        if (this.path) {
          link = this.path.replace('{rootFolder}', indiciaData.rootFolder);
          if (this.urlParams) {
            link += link.indexOf('?') === -1 ? '?' : '&';
            $.each(this.urlParams, function eachParam(name, value) {
              // Find any field name replacements.
              var fieldMatches = value.match(/\[(.*?)\]/g);
              var updatedVal = value;
              $.each(fieldMatches, function eachMatch(i, fieldToken) {
                var dataVal;
                // Cleanup the square brackets which are not part of the field name.
                var field = fieldToken.replace(/\[/, '').replace(/\]/, '');
                dataVal = indiciaFns.getValueForField(doc, field);
                updatedVal = value.replace(fieldToken, dataVal);
              });
              link += name + '=' + updatedVal;
            });
          }
          item = '<a href="' + link + '" title="' + this.title + '">' + item + '</a>';
        }
        html += item;
      }
    });
    return html;
  }

  /**
   * Find the data used to populate the table in the response.
   *
   * Data can be found in the response hits (i.e. standard occurrence
   * documents), the buckets of an aggregation, or a custom built source table.
   */
  function getSourceDataList(el, response) {
    if (el.settings.sourceTable) {
      // A custom table built from an aggregation by the source.
      return response[$(el)[0].settings.sourceTable];
    } else if (el.settings.aggregation && typeof response.aggregations !== 'undefined') {
      // A standard aggregation.
      return indiciaFns.findValue(response.aggregations, 'buckets');
    }
    // A standard list of records.
    return response.hits.hits;
  }

  function drawMediaFile(i, doc, file, sizeClass) {
    // Check if an extenral URL.
    var match = file.path.match(/^http(s)?:\/\/(www\.)?([a-z(\.kr)]+)/);
    var captionItems = [];
    var captionAttr;
    var html = '';
    if (file.caption) {
      captionItems.push(file.caption);
    }
    if (file.licence) {
      captionItems.push('Licence is ' + file.licence);
    }
    captionAttr = captionItems.length ? ' title="' + captionItems.join(' | ').replace('"', '&quot;') + '"' : '';
    if (match !== null) {
      // If so, is it iNat? We can work out the image file names if so.
      if (file.path.match(/^https:\/\/static\.inaturalist\.org/)) {
        html += '<a ' + captionAttr +
          'href="' + file.path.replace('/square.', '/large.') + '" ' +
          'class="inaturalist fancybox" rel="group-' + doc.id + '">' +
          '<img class="' + sizeClass + '" src="' + file.path + '" /></a>';
      } else {
        html += '<a ' +
          'href="' + file.path + '" class="social-icon ' + match[3].replace('.', '') + '"></a>';
        if (captionItems.length) {
          html += '<p>' + captionItems.join(' | ').replace('"', '&quot;') + '</p>';
        }
      }
    } else if ($.inArray(file.path.split('.').pop(), ['mp3', 'wav']) > -1) {
      // Audio files can have a player control.
      html += '<audio controls ' +
        'src="' + indiciaData.warehouseUrl + 'upload/' + file.path + '" type="audio/mpeg"/>';
    } else {
      // Standard link to Indicia image.
      html += '<a ' + captionAttr +
        'href="' + indiciaData.warehouseUrl + 'upload/' + file.path + '" ' +
        'class="fancybox" rel="group-' + doc.id + '">' +
        '<img class="' + sizeClass + '" src="' + indiciaData.warehouseUrl + 'upload/thumb-' + file.path + '" />' +
        '</a>';
    }
    return html;
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
   * Outputs the HTML for the table footer.
   *
   * @param obj response
   *   Elasticsearch response data.
   * @param obj data
   *   Data sent in request.
   */
  function drawTableFooter(el, response, data, afterKey) {
    var fromRowIndex = typeof data.from === 'undefined' ? 1 : (data.from + 1);
    // Set up the count info in the footer.
    if (!el.settings.aggregation) {
      if (response.hits.hits.length > 0) {
        $(el).find('tfoot .showing').html('Showing ' + fromRowIndex +
          ' to ' + (fromRowIndex + (response.hits.hits.length - 1)) + ' of ' + response.hits.total);
      } else {
        $(el).find('tfoot .showing').html('No hits');
      }
      // Enable or disable the paging buttons.
      $(el).find('.pager .prev').prop('disabled', fromRowIndex <= 1);
      $(el).find('.pager .next').prop('disabled', fromRowIndex + response.hits.hits.length >= response.hits.total);
    } else if (el.settings.aggregation === 'composite') {
      if (afterKey) {
        el.settings.compositeInfo.pageAfterKeys[el.settings.compositeInfo.page + 1] = afterKey;
      }
      $(el).find('.pager .next').prop('disabled', !afterKey);
      $(el).find('.pager .prev').prop('disabled', el.settings.compositeInfo.page === 0);
    }
  }

  /**
   * Return the <td> elements for special behaviours in a row.
   *
   * Includes row selection and responsive table toggle cells.
   */
  function getRowBehaviourCells(el) {
    var cells = [];
    if ($(el).find('table.multiselect-mode').length) {
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
    $.each(el.settings.columns, function eachColumn(idx) {
      var value;
      var rangeValue;
      var sizeClass;
      var classes = ['col-' + idx];
      var style = '';
      var colDef = el.settings.availableColumnInfo[this];
      var media = '';
      var date;
      value = indiciaFns.getValueForField(doc, this);
      if (colDef.range_field) {
        rangeValue = indiciaFns.getValueForField(doc, colDef.range_field);
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
      if (value && colDef.handler && colDef.handler === 'media') {
        // Tweak image sizes if more than 1.
        sizeClass = value.length === 1 ? 'single' : 'multi';
        // Build media HTML.
        $.each(value, function eachFile(i, file) {
          media += drawMediaFile(i, doc, file, sizeClass);
        });
        value = media;
        // Approximate a column size to accomodate the thumbnails.
        maxCharsPerCol['col-' + idx] = Math.max(maxCharsPerCol['col-' + idx], value.length === 1 ? 8 : 14);
      } else {
        maxCharsPerCol['col-' + idx] = Math.max(maxCharsPerCol['col-' + idx], $('<p>' + value + '</p>').text().length);
      }
      classes.push('field-' + this.replace('.', '--').replace('_', '-'));
      // Copy across responsive hidden cols.
      if ($(el).find('table th.col-' + idx).css('display') === 'none') {
        style = ' style="display: none"';
      }
      cells.push('<td class="' + classes.join(' ') + '"' + style + '>' + value + '</td>');
      // Extra space in last col to account for tool icons.
      if (idx === el.settings.columns.length - 1 && !el.settings.actions.length) {
        maxCharsPerCol['col-' + idx] += 1;
      }
      return true;
    });
    return cells;
  }

  /**
   * After population of the table, fire callbacks.
   *
   * Callbacks may be linked to the populate event or the rowSelect event if
   * the selected row changes.
   */
  function fireAfterPopulationCallbacks(el) {
    // Fire any population callbacks.
    $.each(el.settings.callbacks.populate, function eachCallback() {
      this(el);
    });
    // Fire callbacks for selected row if any.
    $.each(el.settings.callbacks.rowSelect, function eachCallback() {
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
    // Column resizing needs to be done manually when tbody has scroll bar.
    if (el.settings.scrollY) {
      $.each(el.settings.columns, function eachColumn(idx) {
        maxCharsPerRow += Math.min(maxCharsPerCol['col-' + idx], 20);
      });
      if (el.settings.responsive) {
        maxCharsPerRow += 3;
        $(el).find('.footable-toggle-col').css('width', (100 * (3 / maxCharsPerRow)) + '%');
      }
      if (el.settings.actions) {
        maxCharsPerRow += 6;
        $(el).find('.col-actions').css('width', (100 * (6 / maxCharsPerRow)) + '%');
      }
      $.each(el.settings.columns, function eachColumn(idx) {
        var allowedColWidth = Math.min(maxCharsPerCol['col-' + idx], 20);
        $(el).find('.col-' + idx).css('width', (100 * (allowedColWidth / maxCharsPerRow)) + '%');
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
      var tbody;
      var totalCols;
      var showingAggregation;
      var footableSort;
      var tableClasses = ['table', 'es-data-grid'];
      var savedCols;
      var tools;
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
      // Validate settings.
      if (typeof el.settings.columns === 'undefined') {
        indiciaFns.controlFail(el, 'Missing columns config for table.');
      }
      // Store original column settings.
      el.settings.defaultColumns = el.settings.columns.slice();
      if (el.settings.cookies && $.cookie) {
        savedCols = $.cookie('cols-' + el.id);
        // Don't recall cookie if empty, as this is unlikely to be deliberate.
        if (savedCols && savedCols !== '[]') {
          applyColumnsList(el, JSON.parse(savedCols));
        }
      }
      if (el.settings.columns.length === 0) {
        el.settings.columns = el.settings.defaultColumns.slice();
      }
      showingAggregation = el.settings.aggregation || el.settings.sourceTable;
      footableSort = showingAggregation && el.settings.sortable ? 'true' : 'false';
      if (el.settings.scrollY) {
        tableClasses.push('fixed-header');
      }
      // Disable filter row for aggregations.
      el.settings.includeFilterRow = el.settings.includeFilterRow && !showingAggregation;
      // Build the elements required for the table.
      table = $('<table class="' + tableClasses.join(' ') + '" data-sort="' + footableSort + '" />').appendTo(el);
      addHeader(el, table);
      // We always want a table body for the data.
      tbody = $('<tbody />').appendTo(table);
      if (el.settings.scrollY) {
        $(tbody).css('max-height', el.settings.scrollY);
      }
      // Output a footer if we want a pager.
      if (el.settings.includePager && !(el.settings.sourceTable || el.settings.aggregation === 'simple')) {
        totalCols = el.settings.columns.length
          + (el.settings.responsive ? 1 : 0)
          + (el.settings.actions.length > 0 ? 1 : 0);
        $('<tfoot><tr class="pager"><td colspan="' + totalCols + '"><span class="showing"></span>' +
          '<span class="buttons"><button class="prev">Previous</button><button class="next">Next</button></span>' +
          '</td></tr></tfoot>').appendTo(table);
      }
      // Add icons for table settings.
      tools = '<span class="fas fa-wrench data-grid-show-settings" title="Click to show grid column settings"></span>';
      if (document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled) {
        tools += '<br/><span class="far fa-window-maximize data-grid-fullscreen" title="Click to view grid in full screen mode"></span>';
      }
      $('<div class="data-grid-tools">' + tools + '</div>').appendTo(el);
      // Add overlay for settings etc.
      $('<div class="data-grid-settings" style="display: none"></div>').appendTo(el);
      $('<div class="loading-spinner" style="display: none"><div>Loading...</div></div>').appendTo(el);
      initHandlers(el);
      if (footableSort === 'true' || el.settings.responsive) {
        // Make grid responsive.
        $(el).indiciaFootableReport(el.settings.responsiveOptions);
      }
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
      if (el.settings.aggregation === 'composite' && !afterKey && el.settings.compositeInfo.page > 0) {
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
      maxCharsPerCol = {};
      $.each(el.settings.columns, function eachColumn(idx) {
        // Status icons allowed to be smaller than a normal col.
        maxCharsPerCol['col-' + idx] = Math.max(el.settings.availableColumnInfo[this].caption.length, this === '#status_icons#' ? 5 : 10);
      });
      $.each(dataList, function eachHit() {
        var hit = this;
        var cells = [];
        var row;
        var selectedClass;
        var doc = hit._source ? hit._source : hit;
        var dataRowId;
        cells = getRowBehaviourCells(el);
        cells = cells.concat(getDataCells(el, doc, maxCharsPerCol));
        if (el.settings.actions.length) {
          cells.push('<td class="col-actions">' + getActionsForRow(el.settings.actions, doc) + '</td>');
          maxCharsPerCol['col-actions'] = 7;
        }
        // Extra char for the last heading as it contains tool icons.
        maxCharsPerCol['col-' + (maxCharsPerCol.length - 1)] += 1;
        selectedClass = (el.settings.selectIdsOnNextLoad && $.inArray(hit._id, el.settings.selectIdsOnNextLoad) !== -1)
          ? ' selected' : '';
        dataRowId = hit._id ? ' data-row-id="' + hit._id + '"' : '';
        row = $('<tr class="data-row' + selectedClass + '"' + dataRowId + '>'
           + cells.join('') +
           '</tr>').appendTo($(el).find('tbody'));
        $(row).attr('data-doc-source', JSON.stringify(doc));
        return true;
      });
      if (el.settings.responsive) {
        $(el).find('table').trigger('footable_redraw');
      }
      drawTableFooter(el, response, data, afterKey);
      fireAfterPopulationCallbacks(el);
      setColWidths(el, maxCharsPerCol);
    },

    /**
     * Register an event handler.
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
     * Hides a row and moves to next row.
     *
     * When an action is taken on a row so it is no longer required in the grid
     * this method hides the row and moves to the next row, for example after
     * a verification accept.
     */
    hideRowAndMoveNext: function hideRowAndMoveNext() {
      var grid = this;
      var oldSelected = $(grid).find('tr.selected');
      var newSelectedId;
      var showingLabel = $(grid).find('.showing');
      var selectedIds = [];

      if ($(grid).find('table.multiselect-mode').length > 0) {
        $.each($(grid).find('input.multiselect:checked'), function eachRow() {
          var tr = $(this).closest('tr');
          selectedIds.push($(tr).attr('data-row-id'));
          tr.remove();
        });
      } else {
        if ($(oldSelected).next('tr').length > 0) {
          newSelectedId = $(oldSelected).next('tr').attr('data-row-id');
        } else if ($(oldSelected).prev('tr').length > 0) {
          newSelectedId = $(oldSelected).prev('tr').attr('data-row-id');
        }
        selectedIds.push($(oldSelected).attr('data-row-id'));
        $(oldSelected).remove();
      }
      $.each(grid.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        // If the number of rows below 75% of page size, reresh the grid.
        if ($(grid).find('table tbody tr.data-row').length < source.settings.size * 0.75) {
          // As ES updates are not instant, we need a temporary must_not match
          // filter to prevent the verified records reappearing.
          if (!source.settings.filterBoolClauses) {
            source.settings.filterBoolClauses = {};
          }
          if (!source.settings.filterBoolClauses.must_not) {
            source.settings.filterBoolClauses.must_not = [];
          }
          source.settings.filterBoolClauses.must_not.push({
            query_type: 'terms',
            field: '_id',
            value: JSON.stringify(selectedIds)
          });
          $(grid)[0].settings.selectIdsOnNextLoad = [newSelectedId];
          // Reload the grid page.
          source.populate(true);
          // Clean up the temporary exclusion filter.
          source.settings.filterBoolClauses.must_not.pop();
          if (!source.settings.filterBoolClauses.must_not.length) {
            delete source.settings.filterBoolClauses.must_not;
          }
        } else {
          // Update the paging info if some rows left.
          showingLabel.html(showingLabel.html().replace(/\d+ of /, $(grid).find('tbody tr.data-row').length + ' of '));
          // Immediately select the next row.
          if (typeof newSelectedId !== 'undefined') {
            $(grid).find('table tbody tr.data-row[data-row-id="' + newSelectedId + '"]').addClass('selected');
          }
          // Fire callbacks for selected row.
          $.each(grid.settings.callbacks.rowSelect, function eachCallback() {
            this($(grid).find('tr.selected').length === 0 ? null : $(grid).find('tr.selected')[0]);
          });
        }
      });
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

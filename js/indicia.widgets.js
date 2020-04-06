/*
jQuery UI widgets - override existing UI plugons.
*/
(function ($) {

  $.widget('indicia.indiciaAutocomplete', $.ui.autocomplete, {
    menuEntries: [],

    selectingItem: false,

    selectionText: '',

    limit: 5,

    options: {
      source: function (term, callback) {
        var params = {};
        $.extend(params, this.options.extraParams, {
          q: term.term,
          limit: this.limit,
          qfield: this.options.captionField
        });
        $.getJSON(this.options.baseUrl, params, callback);
      },
      extraParams: {},
      // Mode options are default, species, person.
      mode: 'default',
      formatOptions: {}
    },

    /**
     * Constructor. Adds a hidden input for the value and links event handlers.
     */
    _create: function () {
      this._super();
      // Apply default format options depending on the mode.
      if (this.options.mode === 'species') {
        this.options.formatOptions = $.extend({}, {
          speciesIncludeBothNames: false,
          speciesIncludeAuthorities: false,
          speciesIncludeTaxonGroup: false,
          speciesIncludeIdDiff: true
        }, this.options.formatOptions);
      }
      // Autogenerate a hidden input to hold the selected ID.
      this.valueInput = $('<input>')
        .attr('type', 'hidden')
        .attr('id', this.options.id)
        .attr('name', this.options.fieldname)
        .val(this.options.default);
      $(this.element).after(this.valueInput);
      this._on(this.element, {
        indiciaautocompletechange: this._onChange,
        indiciaautocompleteselect: this._onSelect,
        indiciaautocompleteresponse: this._onResponse
      });
      // Override initial limit if specified in options.
      if (typeof this.options.extraParams.limit !== 'undefined') {
        this.limit = this.options.extraParams.limit;
      }
      // Disable browser autocomplete.
      $(this)
        // Set a random string as browsers don't respect correct "off" setting:
        // https://gist.github.com/niksumeiko/360164708c3b326bd1c8
        .attr('autocomplete', 'please_dont_autocomplete')
        .attr('autocorrect', 'off')
        .attr('spellcheck', 'false');
    },

    /**
     * Public method to add values to the search filter.
     *
     * Can be called via $('...').indiciaAutocomplete('setExtraParams', []);
     *
     * @param array values
     */
    unsetExtraParams: function(values) {
      $.extend(this.options.extraParams, values);
    },

    /**
     * Public method to remove values from the search filter.
     *
     * Can be called via $('...').indiciaAutocomplete('unsetExtraParams', []);
     *
     * @param array values
     */
    unsetExtraParams: function(values) {
      var el = this;
      $.each(values, function eachValue() {
        delete el.options.extraParams[this];
      });
    },

    /**
     * If user changes text in the input, clear the stored value.
     */
    _onChange: function() {
      if ($(this.element).val() !== this.selectionText) {
        this.valueInput.val('');
      }
    },

    /**
     * On select of an item, fill in the value and caption.
     */
    _onSelect: function (event, ui) {
      var displayName;
      if (typeof ui.item.moreSelector !== 'undefined') {
        return false;
      }
      // Flag so we know this is a deliberate selection in any change event.
      this.selectingItem = true;
      this.valueInput.val(ui.item[this.options.valueField]);
      if (this.options.mode === 'species') {
        displayName = ui.item.taxon;
        if (this.options.formatOptions.speciesIncludeAuthorities && ui.item.authority !== null) {
          displayName += ' ' + ui.item.authority;
        }
        $(this.element).val(displayName);
      } else {
        $(this.element).val(ui.item[this.options.captionField]);
      }
      if (typeof ui.item.icon !== 'undefined') {
        $(this.element).after(ui.item.icon).next().hover(indiciaFns.hoverIdDiffIcon);
      }
      // Trigger a change event.
      this.valueInput.trigger('change', ui.item);
      // Reset selectingItem flag.
      this.selectingItem = false;
      // Remember the chosen text so we can be sure if it's changed.
      this.selectionText = $(this.element).val();

      // Prevent the default behaviuor overwriting the displayed value.
      return false;
    },

    /**
     * Response handler.
     *
     * On AJAX response, clear the current value in the hidden input.
     */
    _onResponse: function () {
      if (!this.selectingItem) {
        this.valueInput.val('');
      }
    },

    /**
     * Formats a taxon name and adds classes for display in the search menu.
     */
    _formatSingleName: function (name, preferred, isLatin, authority, isSearchedName) {
      var display;
      var formattedName = isLatin ? '<em>' + name + '</em>' : name;
      var classes = [
        isSearchedName ? 'searched-name' : 'other-name',
        isLatin ? 'scientific' : 'common'
      ];
      if (this.options.formatOptions.speciesIncludeAuthorities && authority !== null) {
        formattedName += ' ' + authority;
      }
      if (preferred) {
        classes.push('preferred');
      } else if (isLatin) {
        formattedName += ' [syn]';
      }
      display = '<div class="' + classes.join(' ') + '">' + formattedName + '</div>';
      return display;
    },

    /**
     * Formats a species response from the taxa_search service.
     */
    _formatSpeciesItem: function (item) {
      // Add the name we are searching for.
      var display = this._formatSingleName(
        item.taxon,
        item.preferred === 't',
        typeof item.language_iso === 'undefined' ? null : item.language_iso === 'lat',
        item.authority,
        true
      );
      // Adds a common name (if searching for latin) or vice versa if configured
      // to do so.
      if (this.options.formatOptions.speciesIncludeBothNames) {
        if (item.preferred === 't'
          && item.default_common_name !== item.taxon && item.default_common_name) {
          display += this._formatSingleName(
            item.default_common_name,
            false,
            false,
            null,
            false
          );
        } else if (item.preferred === 'f'
          && (item.preferred_taxon !== item.taxon || item.preferred_authority !== item.authority)) {
          display += this._formatSingleName(
            item.preferred_taxon,
            true,
            true,
            item.preferred_authority,
            false
          );
        }
      }
      // Add the taxon group.
      if (this.options.formatOptions.speciesIncludeTaxonGroup) {
        display += '<div class="taxon-group">' + item.taxon_group + '</div>';
      }
      // Adds an identification difficulty icon if required.
      if (this.options.formatOptions.speciesIncludeIdDiff &&
          item.identification_difficulty && item.identification_difficulty > 1) {
        display += ' <span ' +
          'class="item-icon id-diff id-diff-' + item.identification_difficulty + '" ' +
          'data-diff="' + item.identification_difficulty + '" ' +
          'data-rule="' + item.id_diff_verification_rule_id + '"></span>';
      }
      return display;
    },

    /**
     * At the start of loading the results menu, clear the tracker for
     * duplicates.
     */
    _startRendering: function() {
      this.menuEntries = [];
    },

    /**
     * Returns true if this name a duplicate of one already in the results
     * menu. A name is considered duplicate if the taxon_meaning_id and
     * visible label are the same - i.e. 2 names for a taxon concept with
     * different author strings are considered duplicates unless
     * speciesIncludeAuthorities is enabled.
     */
    _doneEntry: function(item) {
      var taxon;
      var checkUnique;
      if (this.options.mode === 'species') {
        if (typeof indiciaData.hiddenTaxonNames !== 'undefined'
            && jQuery.inArray(item.taxon, indiciaData.hiddenTaxonNames) > -1) {
          // Skip name.
          return true;
        }
        // Note we track the distinct meaning id and display term, so we don't output duplicates
        // display field does not seem to be available, though there may be some form somewhere which uses it.
        taxon = typeof indiciaFns.uniqueTaxonSimplify === 'undefined' ?
          item.taxon.replace(/\W+/g, '').toLowerCase() : indiciaFns.uniqueTaxonSimplify(item.taxon);
        checkUnique = item.taxon_meaning_id + ':' + taxon;
        // Only include the authority if the user can see it.
        if (this.options.speciesIncludeAuthorities) {
          checkUnique += ':' + item.authority;
        }
        // If this name is unique or the first instance, show it.
        if ($.inArray(checkUnique, this.menuEntries) === -1) {
          this.menuEntries.push(checkUnique);
        } else {
          return true;
        }
      }
      return false;
    },

    /**
     * Widget _renderManu handler.
     */
    _renderMenu: function(ul, items) {
      var that = this;
      this._startRendering();
      $.each(items, function(index, item) {
        if (!that._doneEntry(item)) {
          // Ensure jQuery UI understands the item's caption.
          item.value = item[that.options.captionField];
          that._renderItemData(ul, item);
        }
      });
      // Alternate entry styling.
      $(ul).find('li:odd').addClass('odd');
      // More items link
      if (items.length >= this.limit) {
        // Add a fake more results item.
        $( "<li>" ).val('')
          .append( $('<a>').addClass('more-results').text( 'More results available...' ) )
          .appendTo(ul)
          .data( "ui-autocomplete-item", {moreSelector: true})
          .click(function() {
            that.limit += 1000;
            // Trigger the search again with the new limit. Needs to be after the select event
            // has completed.
            setTimeout(function() {
              $(that.element).indiciaAutocomplete('search');
            }, 100);
          });
      }
    },

    /**
     * Widget _renderItem handler. Delegates to the rendering handler for the current mode.
     */
    _renderItem: function (ul, item) {
      var display;
      if (this.options.mode === 'species') {
        display = this._formatSpeciesItem(item);
      } else {
        // @todo Implement formatItem option to allow this to be overridden.
        display = item[this.options.captionField];
      }
      return $('<li>')
        .append('<div>' + display + '</div>')
        .appendTo(ul);
    }

  });
}(jQuery));

/* Indicia, the OPAL Online Recording Toolkit.
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
 */

 /**
  * Functions to support species autocompletes that enable immediate addition
  * of new taxa  when the searched for taxa cannot be found.
  */
 jQuery(document).ready(function($) {
  'use strict';

  var currentInput;

  /**
   * PHP ucfirst function equivalent.
   */
  function ucfirst(str) {
    var firstChar = str.charAt(0);
    var strWithoutFirstChar = str.slice(1);
    firstChar = firstChar.toUpperCase();
    return firstChar + strWithoutFirstChar;
  }

  /**
   * Add new taxon button click handler.
   */
  indiciaFns.on('click', '.add-new-taxon', {}, function() {
    currentInput = $(this).parent().find('input:visible');
    $('#new-taxon-name').val(ucfirst(currentInput.val()));
    $('#new-taxon-group').val('');
    $.fancybox($('#new-taxon-form'));
  });

  /**
   * Popup form Save button click handler.
   *
   * Adds a new taxon to the database.
   */
  function saveAddedTaxon() {
    var taxon = {
      website_id: indiciaData.website_id,
      user_id: indiciaData.user_id,
      'taxa_taxon_list:taxon_list_id': indiciaData.allowTaxonAdditionToList,
      'taxa_taxon_list:preferred': 't',
      'taxon:taxon': $('#new-taxon-name').val().trim(),
      'taxon:taxon_group_id': $('#new-taxon-group').val().trim(),
      'taxon:language_id': indiciaData.latinLanguageId,
    };
    if ($('#new-taxon-name').val().trim() === '' || !$('#new-taxon-group').val()) {
      alert('Please fill in all the values before proceeding.')
      return false;
    }
    // Post new taxa to the warehouse.
    $.post(indiciaData.taxonAdditionPostUrl, taxon,
      function (data) {
        if (data.success) {
          if ($(currentInput).closest('.species-grid').length > 0) {
            // Get the grid to handle the new taxon.
            handleSelectedTaxon(
              {target: currentInput[0]},
              {
                taxa_taxon_list_id: data.outer_id,
                searchterm:$('#new-taxon-name').val().trim(),
                highlighted: $('#new-taxon-name').val().trim(),
                taxon: $('#new-taxon-name').val().trim(),
                authority: '',
                language_iso: 'lat',
                preferred_taxon: $('#new-taxon-name').val().trim(),
                preferred_authority: '',
                default_common_name :null,
                taxon_group: $('#new-taxon-group option:selected').text(),
                preferred: 't',
                preferred_taxa_taxon_list_id: data.outer_id
              },
              data.outer_id
            );
          } else {
            // Normal single species input control.
            $('#occurrence\\:taxa_taxon_list_id').val(data.outer_id);
          }
          alert('Your record will be saved against the proposed taxon which will be reviewed by an expert.');
          $(currentInput).parent().find('.add-new-taxon').remove();
        }
      },
      'json'
    );
    $.fancybox.close();
    return false;
  }

  indiciaFns.on('click', '#do-add-new-taxon', {}, saveAddedTaxon);

  /**
   * Hook into autocomplete lookup failures.
   */
  if (!indiciaFns.hookTaxonLookupFailed) {
    indiciaFns.hookTaxonLookupFailed = [];
  }
  indiciaFns.hookTaxonLookupFailed.push(function(input) {
    if (indiciaData.allowTaxonAdditionToList) {
      if ($(input).parent().find('.add-new-taxon').length === 0) {
        $(input).after('<span class="add-new-taxon" title="Request a new taxon" style="' +
          'top: ' + (input.offsetTop + 2) + 'px; ' +
          'height: ' + (input.clientHeight - 4) + 'px; ' +
          'width: ' + (input.clientHeight - 4) + 'px; ' +
          'left: ' + (input.clientWidth - input.clientHeight) + 'px; ' +
          '">+</span>');
      }
    }
  });
});
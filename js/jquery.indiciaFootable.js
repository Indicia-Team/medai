//
// jQuery plugin to add html to inidica report tables and then invoke
// footables upon them to make them responsive.
// http://fooplugins.com/plugins/footable-jquery/
//
(function($){
  // Add indiciaFootable to the jQuery function object.
  $.fn.indiciaFootable = function(options) {
    
    // Loop through the selected items (which are assumed to be indicia
    // report grid containers).
    this.each(function() {
      // Work on the table which is a child of the container div.
      var $table = $(this).find('table');
      
      // Using the version-independent 'on' function requires a selector for 
      // the table to uniquely locate it from the context of document.
      var tableSelector = '#' + $(this).attr('id') + ' table';

      // We need to manually remove the filter row before trying to 
      // initialise with FooTable.
      var $filterRow = removeFilterRow($table);
      
      // Attach an event handler to precede the normal footable_redraw to  
      // remove the filter row on all future changes too.      
      indiciaFns.on('footable_resizing.indiciaFootable', tableSelector, {}, function(){
        var $table = $(this);
        // Remove the filter row from the thead before calling footable
        $table.find('.filter-row').detach();
      });

      // Get all the responsive goodness from FooTable.
      $table.footable(options);

      // Manually restore the filter row after initialisation with FooTable.
      restoreFilterRow($table, $filterRow);
      
      // Attach an event handler to follow the normal footable_redraw to  
      // reattach the filter row on all future changes.      
      indiciaFns.on('footable_resized.indiciaFootable', tableSelector, $filterRow, function(){
        var $table = $(this);
        restoreFilterRow($table, $filterRow);
      });      
    });
    
    // Return the original object for chaining.
    return this;
  }
  
  function removeFilterRow($table) {
    return $table.find('.filter-row').detach();
  }
  
  function restoreFilterRow($table, $filterRow) {
    // If there is no filter row then do nothing.
    if($filterRow.length == 0) return;
    
    // Each filter cell needs restoring with the same visibility as the
    // corresponding header cell
    var $headerCells = $table.find('th');
    var $filterCells = $filterRow.find('th');
    // Loop through the table headers
    $headerCells.each(function(index) {
      var $filterCell = $filterCells.eq(index);
      if($(this).css('display') == 'none') {
        // This column is hidden so hide it in the filter.
        $filterCell.eq(index).css('display', 'none');
        $filterCell.removeClass('footable-visible');
      }
      else {
        // This column is visible so ensure it appears in the filter.
        $filterCell.eq(index).css('display', 'initial');
      }
    });
    $table.find('thead tr').after($filterRow);
    
  }
  
})(jQuery);
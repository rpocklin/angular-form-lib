<div class="aside bs-docs-aside" tabindex="-1" role="dialog">
  <div class="aside-dialog">
    <div class="aside-content">
      <div class="aside-header" ng-show="title">
        <button type="button" class="close" ng-click="$hide()">&times;</button>
        <h4 class="aside-title" ng-bind-html="title"></h4>
      </div>
      <div class="aside-body bs-sidebar" style="float:right;" ng-click="$hide();">
        <div docs-sidenav></div>
      </div>
    </div>
  </div>
</div>

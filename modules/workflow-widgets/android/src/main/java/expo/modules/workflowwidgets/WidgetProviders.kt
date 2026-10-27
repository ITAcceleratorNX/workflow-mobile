package expo.modules.workflowwidgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent

class NearestTaskWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == WidgetIntents.ACTION_REFRESH) {
      refreshAll(context)
      return
    }
    super.onReceive(context, intent)
  }

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    val entries = WidgetTimelineStore.read(context)
    val now = System.currentTimeMillis()
    val entry = WidgetTimelineStore.active(entries, now)
    for (widgetId in appWidgetIds) {
      appWidgetManager.updateAppWidget(widgetId, nearestRemoteViews(context, entry, widgetId))
    }
    WidgetIntents.schedule(context, WidgetTimelineStore.nextAt(entries, now))
  }

  companion object {
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, NearestTaskWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      if (ids.isEmpty()) {
        val entries = WidgetTimelineStore.read(context)
        WidgetIntents.schedule(context, WidgetTimelineStore.nextAt(entries, System.currentTimeMillis()))
        return
      }
      NearestTaskWidgetProvider().onUpdate(context, manager, ids)
    }
  }
}

class CreateTaskWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (widgetId in appWidgetIds) {
      appWidgetManager.updateAppWidget(
        widgetId,
        actionRemoteViews(context, R.layout.workflow_widget_create_task, WidgetIntents.CREATE_TASK_URL, 7300 + widgetId),
      )
    }
  }
}

class WidgetBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    NearestTaskWidgetProvider.refreshAll(context)
  }
}

class CreateRequestWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (widgetId in appWidgetIds) {
      appWidgetManager.updateAppWidget(
        widgetId,
        actionRemoteViews(
          context,
          R.layout.workflow_widget_create_request,
          WidgetIntents.CREATE_REQUEST_URL,
          7400 + widgetId,
        ),
      )
    }
  }
}

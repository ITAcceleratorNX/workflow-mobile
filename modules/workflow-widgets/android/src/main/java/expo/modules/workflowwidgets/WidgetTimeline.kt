package expo.modules.workflowwidgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

internal data class WidgetEntry(
  val at: Long,
  val eyebrow: String,
  val title: String,
  val subtitle: String,
  val url: String,
)

internal object WidgetTimelineStore {
  private const val PREFS = "workflow_widgets"
  private const val KEY = "timeline"

  fun save(context: Context, json: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
  }

  fun read(context: Context): List<WidgetEntry> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyList()
    return try {
      val array = JSONObject(raw).optJSONArray("entries") ?: return emptyList()
      buildList {
        for (index in 0 until array.length()) {
          val item = array.optJSONObject(index) ?: continue
          val title = item.optString("title")
          if (title.isEmpty()) continue
          add(
            WidgetEntry(
              at = item.optLong("at"),
              eyebrow = item.optString("eyebrow"),
              title = title,
              subtitle = item.optString("subtitle"),
              url = item.optString("url"),
            )
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun active(entries: List<WidgetEntry>, now: Long): WidgetEntry? {
    if (entries.isEmpty()) return null
    val sorted = entries.sortedBy { it.at }
    return sorted.lastOrNull { it.at <= now } ?: sorted.first()
  }

  fun nextAt(entries: List<WidgetEntry>, now: Long): Long? {
    return entries.map { it.at }.filter { it > now }.minOrNull()
  }
}

internal object WidgetIntents {
  const val ACTION_REFRESH = "expo.modules.workflowwidgets.REFRESH"
  const val CREATE_TASK_URL = "workflowmobile://widget/task/create"
  const val CREATE_REQUEST_URL = "workflowmobile://widget/request/create"

  fun openApp(context: Context, url: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
      setPackage(context.packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    return PendingIntent.getActivity(context, requestCode, intent, pendingFlags())
  }

  fun refresh(context: Context): PendingIntent {
    val intent = Intent(context, NearestTaskWidgetProvider::class.java).apply { action = ACTION_REFRESH }
    return PendingIntent.getBroadcast(context, 7101, intent, pendingFlags())
  }

  fun schedule(context: Context, at: Long?) {
    val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pending = refresh(context)
    alarm.cancel(pending)
    if (at == null || at <= System.currentTimeMillis()) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarm.setAndAllowWhileIdle(AlarmManager.RTC, at, pending)
    } else {
      alarm.set(AlarmManager.RTC, at, pending)
    }
  }

  private fun pendingFlags(): Int {
    return PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  }
}

internal fun nearestRemoteViews(context: Context, entry: WidgetEntry?, widgetId: Int): RemoteViews {
  val views = RemoteViews(context.packageName, R.layout.workflow_widget_nearest)
  val eyebrow = entry?.eyebrow ?: "Workflow"
  val title = entry?.title ?: "Откройте приложение"
  val subtitle = entry?.subtitle.orEmpty()
  val url = entry?.url?.takeIf { it.isNotEmpty() } ?: "workflowmobile://widget/tasks"
  views.setTextViewText(R.id.workflow_widget_eyebrow, eyebrow)
  views.setTextViewText(R.id.workflow_widget_title, title)
  views.setTextViewText(R.id.workflow_widget_subtitle, subtitle)
  views.setViewVisibility(R.id.workflow_widget_subtitle, if (subtitle.isEmpty()) View.GONE else View.VISIBLE)
  views.setOnClickPendingIntent(R.id.workflow_widget_root, WidgetIntents.openApp(context, url, 7200 + widgetId))
  return views
}

internal fun actionRemoteViews(context: Context, layout: Int, url: String, requestCode: Int): RemoteViews {
  val views = RemoteViews(context.packageName, layout)
  views.setOnClickPendingIntent(R.id.workflow_widget_root, WidgetIntents.openApp(context, url, requestCode))
  return views
}

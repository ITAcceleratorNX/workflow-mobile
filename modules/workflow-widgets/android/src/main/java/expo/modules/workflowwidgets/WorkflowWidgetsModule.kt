package expo.modules.workflowwidgets

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WorkflowWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WorkflowWidgets")

    AsyncFunction("setTimeline") { json: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WidgetTimelineStore.save(context, json)
      NearestTaskWidgetProvider.refreshAll(context)
    }
  }
}

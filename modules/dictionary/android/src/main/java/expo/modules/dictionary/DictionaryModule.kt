package expo.modules.dictionary

import android.content.Intent
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class DictionaryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Dictionary")

    AsyncFunction("hasDefinition") { word: String, promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.resolve(false)
        return@AsyncFunction
      }

      val intent = Intent(Intent.ACTION_DEFINE).apply {
        putExtra(Intent.EXTRA_TEXT, word)
      }

      val resolveInfo = context.packageManager.queryIntentActivities(
        intent,
        PackageManager.MATCH_DEFAULT_ONLY
      )

      promise.resolve(resolveInfo.isNotEmpty())
    }

    AsyncFunction("showDefinition") { word: String, promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.resolve(false)
        return@AsyncFunction
      }

      val intent = Intent(Intent.ACTION_DEFINE).apply {
        putExtra(Intent.EXTRA_TEXT, word)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      val resolveInfo = context.packageManager.queryIntentActivities(
        intent,
        PackageManager.MATCH_DEFAULT_ONLY
      )

      if (resolveInfo.isEmpty()) {
        // Fallback: Try ACTION_WEB_SEARCH as alternative
        val webSearchIntent = Intent(Intent.ACTION_WEB_SEARCH).apply {
          putExtra("query", "define $word")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val webResolveInfo = context.packageManager.queryIntentActivities(
          webSearchIntent,
          PackageManager.MATCH_DEFAULT_ONLY
        )

        if (webResolveInfo.isNotEmpty()) {
          try {
            context.startActivity(webSearchIntent)
            promise.resolve(true)
          } catch (e: Exception) {
            promise.resolve(false)
          }
        } else {
          promise.resolve(false)
        }
        return@AsyncFunction
      }

      try {
        context.startActivity(intent)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.resolve(false)
      }
    }
  }
}

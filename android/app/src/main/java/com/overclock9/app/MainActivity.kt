package com.overclock9.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.io.ByteArrayInputStream
import java.io.InputStream

private const val HOST = "overclock9.local"
private const val ORIGIN = "https://$HOST"

class MainActivity : Activity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webview)

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_NO_CACHE
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.addJavascriptInterface(QaBridge(this), "OverclockAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetResponse(request) ?: super.shouldInterceptRequest(view, request)

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                view.postDelayed({
                    view.evaluateJavascript(
                        """JSON.stringify({
                            url: location.href,
                            launcher: !document.getElementById('screen-launcher')?.classList.contains('hidden'),
                            api: !!window.__OVERCLOCK,
                            qa: !!document.getElementById('qa-panel'),
                            main: !!document.querySelector('[role=main]'),
                            mode: window.__OVERCLOCK?.accounts?.mode || null
                        })""".trimIndent()
                    ) { state -> Log.d("OverclockQA", state ?: "sin estado") }
                }, 1500)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                if (url.startsWith(ORIGIN)) return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                } catch (_: Exception) {
                    true
                }
            }
        }

        if (savedInstanceState == null) webView.loadUrl("$ORIGIN/?qa=1")
    }

    /** Sirve el juego desde assets bajo un origen https real: así funcionan los módulos ES. */
    private fun assetResponse(request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        if (uri.host != HOST) return null
        var path = (uri.path ?: "").removePrefix("/")
        if (path.isEmpty()) path = "index.html"
        path = path.replace("..", "")
        return try {
            val stream: InputStream = assets.open("web/$path")
            val type = mimeType(path)
            val encoding = if (isText(type)) "utf-8" else null
            WebResourceResponse(type, encoding, stream).apply {
                val headers = HashMap<String, String>()
                headers["Cache-Control"] = "no-store"
                headers["Access-Control-Allow-Origin"] = "*"
                responseHeaders = headers
            }
        } catch (_: Exception) {
            WebResourceResponse(
                "text/plain", "utf-8",
                ByteArrayInputStream("Recurso no encontrado: $path".toByteArray(Charsets.UTF_8))
            )
        }
    }

    private fun mimeType(path: String): String = when {
        path.endsWith(".html") -> "text/html"
        path.endsWith(".css") -> "text/css"
        path.endsWith(".js") -> "application/javascript"
        path.endsWith(".json") -> "application/json"
        path.endsWith(".svg") -> "image/svg+xml"
        path.endsWith(".png") -> "image/png"
        path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
        path.endsWith(".webp") -> "image/webp"
        path.endsWith(".woff2") -> "font/woff2"
        else -> "application/octet-stream"
    }

    private fun isText(type: String): Boolean =
        type.startsWith("text/") || type.contains("javascript") || type.contains("json")

    @Suppress("DEPRECATION")
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    /** Puente opcional: el panel ?qa=1 puede copiar métricas sin depender del portapapeles web. */
    inner class QaBridge(private val context: Context) {
        @JavascriptInterface
        fun copyMetrics(json: String) {
            val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            manager.setPrimaryClip(ClipData.newPlainText("OVERCLOCK 9 · métricas", json))
            Toast.makeText(context, "MÉTRICAS COPIADAS", Toast.LENGTH_SHORT).show()
        }
    }
}

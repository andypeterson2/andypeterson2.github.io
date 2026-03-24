"""Theme CSS for the Textual dashboard."""

DASHBOARD_CSS = """
Screen {
    background: #2d2b22;
    color: #d4be98;
}
Header {
    background: #3a3830;
    color: #d8a657;
}
Footer {
    background: #3a3830;
}
#toolbar {
    height: 3;
    padding: 0 1;
    background: #3a3830;
    dock: top;
}
#toolbar Button {
    margin: 0 1 0 0;
    min-width: 12;
}
#toolbar-status {
    content-align: right middle;
    width: 1fr;
    color: $text-muted;
}
#summary-bar {
    height: 1;
    padding: 0 1;
    background: #3a3830;
    dock: top;
}
#service-tabs {
    height: 1fr;
}
#service-tabs TabPane {
    padding: 0;
}
"""

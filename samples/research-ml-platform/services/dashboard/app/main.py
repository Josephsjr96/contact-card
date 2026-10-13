import streamlit as st
from api_client import get_active_deployment, analytics_summary, MODEL_NAME

st.set_page_config(page_title="Poetic Translation Research Platform", page_icon="🌐", layout="wide")

st.title("🌐 Poetic Translation Research Platform")
st.caption("Persian ↔ German ↔ Polish · NLLB-200 vs M2M-100 · Canary-deployed research MLOps stack")

st.markdown("""
Use the sidebar to navigate:
- **Translation** — run a translation, see NLLB vs M2M side by side with poetic feature analysis
- **Evaluation** — rate a translation (fluency, poetic preservation, cultural accuracy)
- **Deployment** — view stable/canary versions, traffic split; promote or roll back
- **Analytics** — aggregate stats, poetic score distribution, model preference trends
- **Collaboration** — research project discussion board
""")

col1, col2, col3 = st.columns(3)

state, err = get_active_deployment()
with col1:
    st.subheader("Current Deployment")
    if err:
        st.warning(f"Registry unavailable: {err}")
    elif state:
        st.metric("Stable version", state.get("stable_version") or "—")
        if state.get("candidate_version"):
            st.metric("Canary version", state.get("candidate_version"),
                       delta=f"{state.get('canary_percentage', 0)}% traffic")
        else:
            st.caption("No active canary")

stats, err2 = analytics_summary()
with col2:
    st.subheader("Research Dataset")
    if err2:
        st.warning(f"Research service unavailable: {err2}")
    elif stats:
        st.metric("Translations logged", stats.get("total_translations", 0))
        st.metric("Human ratings", stats.get("total_ratings", 0))

with col3:
    st.subheader("Model Preference")
    if stats:
        st.metric("NLLB preferred", f"{stats.get('nllb_preferred_pct', 0):.0f}%")
        st.metric("M2M preferred", f"{stats.get('m2m_preferred_pct', 0):.0f}%")

st.divider()
st.caption(f"Tracking Registry model name: `{MODEL_NAME}`")

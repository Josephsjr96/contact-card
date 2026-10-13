import streamlit as st
import pandas as pd
from api_client import analytics_summary, list_ratings, list_translations

st.set_page_config(page_title="Analytics", page_icon="📊", layout="wide")
st.title("📊 Analytics & Export")

stats, err = analytics_summary()
if err:
    st.error(f"Research service unavailable: {err}")
    st.stop()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total translations", stats["total_translations"])
c2.metric("Total ratings", stats["total_ratings"])
c3.metric("Avg poetic score", f"{stats['avg_poetic_score']:.2f}")
c4.metric("Avg cultural accuracy", f"{stats['avg_cultural_accuracy']:.2f} / 5")

st.divider()
st.subheader("Model Preference Split")
pref_df = pd.DataFrame({
    "Model": ["NLLB-200", "M2M-100", "Equal", "Neither"],
    "Percentage": [stats["nllb_preferred_pct"], stats["m2m_preferred_pct"],
                    stats["equal_pct"], stats["neither_pct"]],
}).set_index("Model")
st.bar_chart(pref_df)

st.subheader("Poetic Score Distribution")
translations, terr = list_translations(limit=1000)
if translations:
    scores = []
    for t in translations:
        pf = t.get("poetic_features") or {}
        for key in ("nllb_output", "m2m_output"):
            if key in pf and "poetic_score" in pf[key]:
                scores.append(pf[key]["poetic_score"])
    if scores:
        score_df = pd.DataFrame({"poetic_score": scores})
        st.bar_chart(score_df["poetic_score"].value_counts(bins=5).sort_index())
    else:
        st.caption("No poetic scores recorded yet.")

st.divider()
st.subheader("Recent Ratings")
ratings, rerr = list_ratings(limit=50)
if ratings:
    st.dataframe(pd.DataFrame(ratings), use_container_width=True)
else:
    st.caption("No ratings yet.")

st.divider()
st.subheader("Export")
if translations:
    st.download_button("Download translations (JSON)",
                        data=pd.DataFrame(translations).to_json(orient="records", force_ascii=False),
                        file_name="translations_export.json", mime="application/json")
if ratings:
    st.download_button("Download ratings (CSV)",
                        data=pd.DataFrame(ratings).to_csv(index=False),
                        file_name="ratings_export.csv", mime="text/csv")

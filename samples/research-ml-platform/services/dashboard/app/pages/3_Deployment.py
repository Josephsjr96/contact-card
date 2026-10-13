import streamlit as st
from api_client import (
    get_active_deployment, list_model_versions, register_model,
    deploy_canary, promote, rollback, get_audit_log, MODEL_NAME,
)

st.set_page_config(page_title="Deployment", page_icon="🚦", layout="wide")
st.title("🚦 Deployment — Model Lifecycle Control")
st.caption(f"Model name: `{MODEL_NAME}` · Registry is the source of truth; this page only calls its API.")

state, err = get_active_deployment()
if err:
    st.error(f"Registry unavailable: {err}")
    st.stop()

col1, col2, col3 = st.columns(3)
col1.metric("Stable version", state.get("stable_version") or "—")
col2.metric("Canary version", state.get("candidate_version") or "—")
col3.metric("Canary traffic %", f"{state.get('canary_percentage', 0)}%")

st.divider()
tab_register, tab_deploy, tab_promote, tab_rollback, tab_audit = st.tabs(
    ["Register", "Deploy Canary", "Promote", "Rollback", "Audit Log"]
)

with tab_register:
    st.subheader("Register a new model version")
    with st.form("register_form"):
        version = st.text_input("Version", placeholder="v3")
        artifact_uri = st.text_input("Artifact URI (MinIO/S3)", placeholder="s3://models/translation/v3")
        submitted = st.form_submit_button("Register", type="primary")
        if submitted:
            result, e = register_model(MODEL_NAME, version, artifact_uri)
            st.error(e) if e else st.success(f"Registered {MODEL_NAME}:{version}")

with tab_deploy:
    st.subheader("Deploy a registered version as canary")
    versions, verr = list_model_versions(MODEL_NAME)
    if verr:
        st.warning(verr)
    else:
        version_names = [v["version"] for v in versions]
        with st.form("deploy_form"):
            v = st.selectbox("Version to deploy as canary", version_names)
            pct = st.slider("Canary traffic percentage", 1, 50, 5)
            submitted = st.form_submit_button("Deploy Canary", type="primary")
            if submitted:
                result, e = deploy_canary(MODEL_NAME, v, pct)
                st.error(e) if e else st.success(f"Deployed {v} as canary at {pct}%")

with tab_promote:
    st.subheader("Promote the current canary to production")
    if state.get("candidate_version"):
        st.write(f"Current candidate: **{state['candidate_version']}**")
        if st.button(f"Promote {state['candidate_version']} to production", type="primary"):
            result, e = promote(MODEL_NAME, state["candidate_version"])
            st.error(e) if e else st.success("Promoted. Traffic is now 100% on the new version.")
    else:
        st.info("No active canary to promote.")

with tab_rollback:
    st.subheader("Roll back the current canary")
    if state.get("candidate_version"):
        reason = st.text_input("Reason", value="manual operator rollback")
        if st.button(f"Rollback {state['candidate_version']}", type="secondary"):
            result, e = rollback(MODEL_NAME, reason)
            st.error(e) if e else st.success("Rolled back. Traffic returned 100% to stable.")
    else:
        st.info("No active canary to roll back.")

with tab_audit:
    st.subheader("Deployment audit trail")
    events, aerr = get_audit_log(MODEL_NAME)
    if aerr:
        st.warning(aerr)
    elif events:
        st.dataframe(events, use_container_width=True)
    else:
        st.caption("No events yet.")

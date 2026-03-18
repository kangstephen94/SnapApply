import { useState } from 'react';
import { APPS_SCRIPT_CODE } from '../utils/constants';
import Feedback from './Feedback';
import type { JobApp, FeedbackMessage } from '../types';

const STEPS = [
  { num: 1, label: 'Create Sheet' },
  { num: 2, label: 'Add Script' },
  { num: 3, label: 'Deploy' },
  { num: 4, label: 'Connect' },
];

interface SetupWizardProps {
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  saveUrl: (url: string) => void;
  syncing: boolean;
  testResult: FeedbackMessage | null;
  syncToSheets: (apps: JobApp[], testOnly: boolean) => void;
  onClose: () => void;
  apps: JobApp[];
}

export default function SetupWizard({
  webhookUrl,
  setWebhookUrl,
  saveUrl,
  syncing,
  testResult,
  syncToSheets,
  onClose,
  apps,
}: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDisconnect = () => {
    saveUrl('');
  };

  const handleSaveAndEnable = () => {
    saveUrl(webhookUrl);
    onClose();
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <div className="step-title">Create a new Google Sheet</div>
            <p className="step-text">
              Go to{' '}
              <a href="https://sheets.new" target="_blank" rel="noopener noreferrer">
                sheets.new
              </a>{' '}
              to create a blank spreadsheet. Name it anything you like.
            </p>
            <p
              className="step-text"
              style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 11 }}
            >
              This sheet is yours — only you can access it.
            </p>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <div className="step-title">Add the sync script</div>
            <p className="step-text">
              In your spreadsheet → <strong>Extensions → Apps Script</strong>.
              Delete existing code and paste:
            </p>
            <div style={{ position: 'relative', marginTop: 8 }}>
              <pre className="code-block">{APPS_SCRIPT_CODE}</pre>
              <button
                className="copy-btn"
                style={{ background: copied ? '#10B981' : '#3B82F6' }}
                onClick={handleCopy}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <p
              className="step-text"
              style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 11 }}
            >
              Save with Ctrl/Cmd + S.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <div className="step-title">Deploy as a Web App</div>
            <div className="step-text">
              <ol>
                <li>
                  Click <strong>Deploy → New deployment</strong>
                </li>
                <li>
                  Gear ⚙️ → select <strong>Web app</strong>
                </li>
                <li>
                  <strong>Execute as</strong>: &quot;Me&quot;
                </li>
                <li>
                  <strong>Who has access</strong>: &quot;Anyone&quot;
                </li>
                <li>
                  Click <strong>Deploy</strong>
                </li>
                <li>Authorize if prompted</li>
                <li>
                  <strong>Copy the Web App URL</strong>
                </li>
              </ol>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <div className="step-title">Paste your URL &amp; test</div>
            <label>
              <span className="form-label">Web App URL</span>
              <input
                className="form-input"
                placeholder="https://script.google.com/macros/s/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={!webhookUrl || syncing}
                onClick={() => syncToSheets(apps, true)}
              >
                {syncing ? '⏳...' : '🧪 Test'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!webhookUrl}
                onClick={handleSaveAndEnable}
              >
                ✅ Save &amp; Enable
              </button>
            </div>
            <Feedback message={testResult} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="wizard">
      <div className="wizard-header">
        <div className="wizard-title">📊 Google Sheets Sync</div>
        <button className="wizard-close" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Step dots */}
      <div className="steps">
        {STEPS.map((s) => (
          <div key={s.num} style={{ flex: 1 }}>
            <div
              className={`step-dot ${step >= s.num ? 'active' : 'inactive'}`}
            >
              {step > s.num ? '✓' : s.num}
            </div>
            <div
              className="step-label"
              style={{
                color:
                  step >= s.num ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {renderStepContent()}

      {/* Navigation */}
      <div className="step-nav">
        {step > 1 ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setStep((s) => s - 1)}
          >
            ← Back
          </button>
        ) : (
          <div />
        )}
        {step < 4 ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setStep((s) => s + 1)}
          >
            Next →
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Disconnect option */}
      {webhookUrl && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#10B981',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            ✅ Connected to Google Sheets
          </div>
          <button
            className="btn btn-secondary btn-sm btn-danger"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

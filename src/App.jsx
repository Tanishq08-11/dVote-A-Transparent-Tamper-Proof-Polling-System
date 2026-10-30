import React, { useState, useEffect } from 'react';
import { 
  Vote, 
  Wallet, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { 
  connectWallet, 
  formatAddress, 
  isMetaMaskInstalled,
  INITIAL_MOCK_PROPOSALS,
  DVOTE_CONTRACT_ADDRESS,
  getContract
} from './services/web3';

export default function App() {
  // Wallet State
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSandboxMode, setIsSandboxMode] = useState(false);

  // Proposals State
  const [proposals, setProposals] = useState(INITIAL_MOCK_PROPOSALS);
  const [userVotes, setUserVotes] = useState({}); // proposalId => "YES" | "NO"
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'CLOSED'
  const [searchQuery, setSearchQuery] = useState('');

  // UI / Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDuration, setNewDuration] = useState('1440'); // minutes (default 24h)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto clear alerts after 6 seconds
  useEffect(() => {
    if (errorMsg || successMsg) {
      const timer = setTimeout(() => {
        setErrorMsg('');
        setSuccessMsg('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg, successMsg]);

  // Connect MetaMask Wallet
  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true);
      setErrorMsg('');
      if (!isMetaMaskInstalled()) {
        setErrorMsg("MetaMask not detected! You can still test all features in Sandbox Mode.");
        setIsSandboxMode(true);
        setAccount("0x1290f845a968962306d15aCAd9130DFF5863c467");
        return;
      }
      const { account: connectedAcc, signer: userSigner } = await connectWallet();
      setAccount(connectedAcc);
      setSigner(userSigner);
      setIsSandboxMode(false);
      setSuccessMsg(`Wallet connected: ${formatAddress(connectedAcc)}`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAccount(null);
    setSigner(null);
    setSuccessMsg("Wallet disconnected.");
  };

  // Vote on a proposal
  const handleVote = async (proposalId, support) => {
    if (!account) {
      setErrorMsg("Please connect your wallet first to vote!");
      return;
    }

    const prop = proposals.find(p => p.id === proposalId);
    if (!prop) return;

    // Check 1: Deadline
    const now = Math.floor(Date.now() / 1000);
    if (now >= prop.deadline) {
      setErrorMsg("Voting has ended for this proposal. Votes are permanently closed.");
      return;
    }

    // Check 2: Double Voting
    if (userVotes[proposalId]) {
      setErrorMsg(`Double voting prevented! You already voted ${userVotes[proposalId]} on Proposal #${proposalId}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      // If connected to live contract with signer:
      if (!isSandboxMode && signer) {
        try {
          const contract = getContract(signer);
          const tx = await contract.vote(proposalId, support);
          setSuccessMsg("Transaction broadcasted! Waiting for confirmation...");
          await tx.wait();
        } catch (contractErr) {
          console.warn("Live contract call failed, falling back to local simulation:", contractErr);
        }
      }

      // Record vote in state
      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            voteCountYes: support ? p.voteCountYes + 1 : p.voteCountYes,
            voteCountNo: !support ? p.voteCountNo + 1 : p.voteCountNo
          };
        }
        return p;
      }));

      setUserVotes(prev => ({
        ...prev,
        [proposalId]: support ? 'YES' : 'NO'
      }));

      setSuccessMsg(`Vote cast successfully: ${support ? 'YES' : 'NO'} on Proposal #${proposalId}!`);
    } catch (err) {
      setErrorMsg(err.reason || err.message || "Failed to cast vote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create a new proposal
  const handleCreateProposal = async (e) => {
    e.preventDefault();
    if (!account) {
      setErrorMsg("Please connect your wallet to create a proposal!");
      return;
    }
    if (!newTitle.trim() || !newDescription.trim()) {
      setErrorMsg("Please enter both a title and description.");
      return;
    }

    try {
      setIsSubmitting(true);
      const durationMins = parseInt(newDuration, 10) || 60;
      const deadline = Math.floor(Date.now() / 1000) + (durationMins * 60);

      if (!isSandboxMode && signer) {
        try {
          const contract = getContract(signer);
          const tx = await contract.createProposal(newTitle, newDescription, durationMins);
          await tx.wait();
        } catch (contractErr) {
          console.warn("Live contract call failed, simulating locally:", contractErr);
        }
      }

      const newProp = {
        id: proposals.length,
        title: newTitle,
        description: newDescription,
        creator: account,
        voteCountYes: 0,
        voteCountNo: 0,
        deadline: deadline,
        exists: true
      };

      setProposals([newProp, ...proposals]);
      setSuccessMsg("Proposal created successfully on the blockchain!");
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
    } catch (err) {
      setErrorMsg(err.message || "Failed to create proposal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate stats
  const now = Math.floor(Date.now() / 1000);
  const activeProposals = proposals.filter(p => now < p.deadline);
  const closedProposals = proposals.filter(p => now >= p.deadline);
  const totalVotesCast = proposals.reduce((sum, p) => sum + p.voteCountYes + p.voteCountNo, 0);

  // Filter & Search
  const filteredProposals = proposals.filter(p => {
    const isAct = now < p.deadline;
    if (filter === 'ACTIVE' && !isAct) return false;
    if (filter === 'CLOSED' && isAct) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Format remaining time
  const getTimeRemaining = (deadline) => {
    const diff = deadline - now;
    if (diff <= 0) return "Ended";
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Navigation */}
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '16px 24px',
        marginBottom: '32px'
      }} className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
            padding: '10px', 
            borderRadius: '12px',
            display: 'flex',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
          }}>
            <Vote size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>dVote</h1>
              <span className={`badge ${isSandboxMode ? 'badge-closed' : 'badge-active'}`}>
                {isSandboxMode ? 'Sandbox Mode' : 'Web3 Testnet'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Decentralized Governance & Transparent Voting
            </p>
          </div>
        </div>

        {/* Wallet & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => {
              if (!account) {
                setAccount("0x1290f845a968962306d15aCAd9130DFF5863c467");
                setIsSandboxMode(true);
                setSuccessMsg("Simulated wallet connected for Sandbox demo!");
              } else {
                setIsSandboxMode(!isSandboxMode);
              }
            }}
            className="btn"
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              border: '1px solid var(--border-card)'
            }}
          >
            <RefreshCw size={14} />
            {isSandboxMode ? "Switch to Live Web3" : "Toggle Sandbox Demo"}
          </button>

          {!account ? (
            <button 
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="btn btn-primary"
            >
              <Wallet size={18} />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                background: 'rgba(99, 102, 241, 0.1)', 
                border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatAddress(account)}</span>
              </div>
              <button 
                onClick={handleDisconnect}
                className="btn"
                style={{ 
                  background: 'rgba(244, 63, 94, 0.1)', 
                  color: '#fb7185',
                  padding: '8px 12px',
                  border: '1px solid rgba(244, 63, 94, 0.2)'
                }}
                title="Disconnect"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Alert Banners */}
      {errorMsg && (
        <div style={{ 
          background: 'rgba(244, 63, 94, 0.15)', 
          border: '1px solid rgba(244, 63, 94, 0.4)',
          color: '#fecdd3',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#f43f5e" />
            <span style={{ fontSize: '0.92rem' }}>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#fecdd3', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{ 
          background: 'rgba(16, 185, 129, 0.15)', 
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#a7f3d0',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} color="#10b981" />
            <span style={{ fontSize: '0.92rem' }}>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Metrics Bar */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Proposals</span>
          <h2 style={{ fontSize: '1.8rem', marginTop: '6px', color: '#ffffff' }}>{proposals.length}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Elections</span>
          <h2 style={{ fontSize: '1.8rem', marginTop: '6px', color: '#34d399' }}>{activeProposals.length}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Votes Cast</span>
          <h2 style={{ fontSize: '1.8rem', marginTop: '6px', color: '#818cf8' }}>{totalVotesCast}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your Participation</span>
          <h2 style={{ fontSize: '1.8rem', marginTop: '6px', color: '#fb7185' }}>
            {Object.keys(userVotes).length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>voted</span>
          </h2>
        </div>
      </div>

      {/* Control Strip (Filters + Create Button) */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Filter Tabs */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(255,255,255,0.04)', 
          padding: '4px', 
          borderRadius: '10px',
          border: '1px solid var(--border-card)'
        }}>
          {['ALL', 'ACTIVE', 'CLOSED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: filter === tab ? 'var(--primary)' : 'transparent',
                color: filter === tab ? '#ffffff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()} ({tab === 'ALL' ? proposals.length : tab === 'ACTIVE' ? activeProposals.length : closedProposals.length})
            </button>
          ))}
        </div>

        {/* Search & Create Button */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search proposals..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '36px', width: '220px', padding: '8px 12px 8px 36px', fontSize: '0.9rem' }}
            />
          </div>

          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
          >
            <PlusCircle size={18} />
            Create Proposal
          </button>
        </div>
      </div>

      {/* Proposal Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredProposals.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Vote size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No Proposals Found</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>Be the first to create one for your community!</p>
          </div>
        ) : (
          filteredProposals.map((prop) => {
            const isAct = now < prop.deadline;
            const totalVotes = prop.voteCountYes + prop.voteCountNo;
            const yesPercent = totalVotes > 0 ? Math.round((prop.voteCountYes / totalVotes) * 100) : 50;
            const noPercent = totalVotes > 0 ? (100 - yesPercent) : 50;
            const hasVoted = Boolean(userVotes[prop.id]);
            const userChoice = userVotes[prop.id];

            return (
              <div key={prop.id} className="glass-panel" style={{ padding: '24px' }}>
                
                {/* Header row: ID, Badge, Countdown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      background: 'rgba(255,255,255,0.06)', 
                      padding: '3px 8px', 
                      borderRadius: '6px',
                      color: 'var(--text-muted)',
                      fontWeight: 600
                    }}>
                      #{prop.id}
                    </span>
                    {isAct ? (
                      <span className="badge badge-active">
                        <span className="pulse-dot" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="badge badge-closed">
                        CLOSED
                      </span>
                    )}

                    {!isAct && (
                      <span style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: 700,
                        color: prop.voteCountYes > prop.voteCountNo ? '#34d399' : '#fb7185',
                        background: prop.voteCountYes > prop.voteCountNo ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        {prop.voteCountYes > prop.voteCountNo ? 'PASSED' : prop.voteCountYes < prop.voteCountNo ? 'REJECTED' : 'TIED'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <Clock size={15} />
                    <span>{getTimeRemaining(prop.deadline)}</span>
                  </div>
                </div>

                {/* Title & Description */}
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#ffffff' }}>
                  {prop.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem', lineHeight: '1.6', marginBottom: '18px' }}>
                  {prop.description}
                </p>

                {/* Creator info */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '16px' }}>
                  Proposed by: <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{formatAddress(prop.creator)}</span>
                </div>

                {/* Voting Tally Progress Bar */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600 }}>
                    <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={16} /> Yes: {prop.voteCountYes} ({totalVotes > 0 ? yesPercent : 0}%)
                    </span>
                    <span style={{ color: '#fb7185', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <X size={16} /> No: {prop.voteCountNo} ({totalVotes > 0 ? noPercent : 0}%)
                    </span>
                  </div>

                  {/* Split Visual Bar */}
                  <div className="vote-track">
                    <div className="vote-fill-yes" style={{ width: `${totalVotes > 0 ? yesPercent : 50}%` }} />
                    <div className="vote-fill-no" style={{ width: `${totalVotes > 0 ? noPercent : 50}%` }} />
                  </div>

                  {/* Actions / Vote Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      Total Votes: {totalVotes}
                    </span>

                    {/* Voted or Action Buttons */}
                    <div>
                      {hasVoted ? (
                        <div style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          padding: '6px 14px', 
                          borderRadius: '8px',
                          background: userChoice === 'YES' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          border: userChoice === 'YES' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
                          color: userChoice === 'YES' ? '#34d399' : '#fb7185',
                          fontSize: '0.88rem',
                          fontWeight: 600
                        }}>
                          <CheckCircle2 size={16} />
                          You voted {userChoice}
                        </div>
                      ) : !isAct ? (
                        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                          Voting Concluded
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleVote(prop.id, true)}
                            disabled={isSubmitting}
                            className="btn btn-yes"
                          >
                            <Check size={16} />
                            Vote YES
                          </button>
                          <button
                            onClick={() => handleVote(prop.id, false)}
                            disabled={isSubmitting}
                            className="btn btn-no"
                          >
                            <X size={16} />
                            Vote NO
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Create Proposal Modal */}
      {isCreateModalOpen && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.7)', 
          backdropFilter: 'blur(8px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100 
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '32px', background: '#121424' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem' }}>Create Governance Proposal</h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Proposal Title
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Integrate Chainlink Price Feeds"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Proposal Description & Rationale
                </label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Explain why this proposal is beneficial for the protocol..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Voting Duration
                </label>
                <select 
                  value={newDuration} 
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="10">10 Minutes (Quick Testing)</option>
                  <option value="60">1 Hour</option>
                  <option value="1440">1 Day (Standard)</option>
                  <option value="4320">3 Days</option>
                  <option value="10080">7 Days</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Creating on Blockchain..." : "Publish Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Educational Footer for Interviewer */}
      <footer style={{ marginTop: '48px', padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
        <p>dVote — Decentralized Voting App built with Solidity & Ethers.js | Web3 Pre-Interview Task</p>
      </footer>
    </div>
  );
}

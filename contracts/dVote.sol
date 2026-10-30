// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title dVote - Decentralized Voting Smart Contract
 * @notice Allows users to create proposals and vote with transparent, tamper-proof tallies.
 */
contract dVote {
    /// @notice Data structure representing an individual voting proposal
    struct Proposal {
        uint256 id;                 // Unique identifier for the proposal
        string title;               // Short title describing the proposal
        string description;         // Full proposal details and rationale
        address creator;            // Wallet address that created the proposal
        uint256 voteCountYes;       // Total number of Yes votes accumulated
        uint256 voteCountNo;        // Total number of No votes accumulated
        uint256 deadline;           // Unix timestamp marking when voting closes
        bool exists;                // Safety flag to verify proposal existence
    }

    /// @notice Dynamic array containing all created proposals
    Proposal[] private proposals;

    /// @notice Mapping to track voter participation: proposalId => (voterAddress => hasVoted)
    /// @dev Prevents double-voting attacks cryptographically on-chain
    mapping(uint256 => mapping(address => bool)) private hasVoted;

    /// @notice Emitted whenever a new voting proposal is created
    /// @param id Unique proposal identifier
    /// @param title Short title of the proposal
    /// @param creator Address of the user who authored the proposal
    /// @param deadline Unix timestamp after which no more votes can be accepted
    event ProposalCreated(
        uint256 indexed id,
        string title,
        address indexed creator,
        uint256 deadline
    );

    /// @notice Emitted whenever a voter casts a vote on an active proposal
    /// @param proposalId ID of the proposal voted on
    /// @param voter Wallet address of the voter
    /// @param support True for Yes, False for No
    /// @param newVoteCountYes Updated tally of Yes votes
    /// @param newVoteCountNo Updated tally of No votes
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 newVoteCountYes,
        uint256 newVoteCountNo
    );

    /**
     * @notice Create a new voting proposal
     * @param _title The short headline of the proposal
     * @param _description Detailed explanation
     * @param _durationInMinutes How long the proposal should stay open (e.g. 60 for 1 hour)
     */
    function createProposal(
        string calldata _title,
        string calldata _description,
        uint256 _durationInMinutes
    ) external returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_durationInMinutes > 0, "Duration must be at least 1 minute");

        uint256 proposalId = proposals.length;
        uint256 deadline = block.timestamp + (_durationInMinutes * 1 minutes);

        proposals.push(
            Proposal({
                id: proposalId,
                title: _title,
                description: _description,
                creator: msg.sender,
                voteCountYes: 0,
                voteCountNo: 0,
                deadline: deadline,
                exists: true
            })
        );

        emit ProposalCreated(proposalId, _title, msg.sender, deadline);
        return proposalId;
    }

    /**
     * @notice Cast a vote on an active proposal
     * @param _proposalId The index ID of the proposal
     * @param _support true = Yes, false = No
     */
    function vote(uint256 _proposalId, bool _support) external {
        require(_proposalId < proposals.length && proposals[_proposalId].exists, "Proposal does not exist");
        Proposal storage prop = proposals[_proposalId];

        // 1. Check if deadline has passed
        require(block.timestamp < prop.deadline, "Voting period has ended");

        // 2. Check if the sender has already voted
        require(!hasVoted[_proposalId][msg.sender], "You have already voted on this proposal");

        // Record that this user voted
        hasVoted[_proposalId][msg.sender] = true;

        // Increment respective vote tally
        if (_support) {
            prop.voteCountYes += 1;
        } else {
            prop.voteCountNo += 1;
        }

        emit Voted(_proposalId, msg.sender, _support, prop.voteCountYes, prop.voteCountNo);
    }

    /**
     * @notice Returns all proposals in a single call for easy frontend rendering
     */
    function getAllProposals() external view returns (Proposal[] memory) {
        return proposals;
    }

    /**
     * @notice Check whether a specific wallet address has already voted on a proposal
     */
    function hasUserVoted(uint256 _proposalId, address _user) external view returns (bool) {
        return hasVoted[_proposalId][_user];
    }

    /**
     * @notice Get total number of proposals
     */
    function getProposalsCount() external view returns (uint256) {
        return proposals.length;
    }
}

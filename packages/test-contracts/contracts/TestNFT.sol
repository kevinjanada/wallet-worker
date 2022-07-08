// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC721Tradable.sol";

/**
 * @title TestNFT
 * TestNFT - just a standard ERC721 NFT Contract.
 */
contract TestNFT is ERC721Tradable {
    constructor(address _proxyRegistryAddress, address[] memory _minters)
        ERC721Tradable("Creature", "OSC", _proxyRegistryAddress, _minters)
    {}

    function baseTokenURI() override public pure returns (string memory) {
        return "https://creatures-api.opensea.io/api/creature/";
    }

    function contractURI() public pure returns (string memory) {
        return "https://creatures-api.opensea.io/contract/opensea-creatures";
    }
}

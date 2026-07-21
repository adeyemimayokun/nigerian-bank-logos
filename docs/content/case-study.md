# awalogo: Building a Reliable Logo Library for Nigerian Products

## Context

The idea for awalogo emerged while I was working on digital products at [Sycamore](https://sycamore.ng).

Our design process regularly required the logos of banks, fintechs, payment providers, and other financial institutions. As designers, we could usually find these assets by searching the web. That worked well enough for mockups and early prototypes, but it created a different problem when those designs moved into development.

Developers needed assets that were reliable, consistently prepared, and easy to reuse. Passing around manually downloaded logo files could lead to duplication, inconsistent versions, unnecessary application weight, and outdated branding entering the final product.

I began to see that this was not simply a logo-search problem. It was an asset-quality and product-infrastructure problem.

## The Problem

There was no dependable, up-to-date resource focused on the Nigerian financial ecosystem.

Logo files found through general web searches varied widely in quality. Some were old, incorrectly cropped, or saved in unsuitable formats. Others came from third-party websites with no clear connection to the institution whose identity they represented.

Existing logo libraries helped to an extent, but many had one or more of the following limitations:

- Limited coverage of Nigerian institutions.
- Missing logos for newer banks and fintech companies.
- Outdated brand identities.
- Unclear asset sources.
- Catalogs that were no longer being actively expanded.

Designers could continue searching manually, but that did not solve the underlying problem for developers or create a reusable source of truth.

## Research and Validation

Before committing to the idea, I reviewed existing logo platforms to understand what they offered and whether another solution was necessary.

The research confirmed that the general concept already existed, but Nigerian coverage remained fragmented. The problem was therefore not the absence of logo libraries; it was the absence of a sufficiently comprehensive and carefully maintained library for the market I was designing for.

This shaped the initial scope. Rather than trying to catalog every company immediately, I focused on Nigerian financial institutions—the group that had originally exposed the problem.

That scope included commercial and microfinance banks, fintechs, payment providers, regulators, insurers, and other organizations within the financial ecosystem.

## Product Strategy

I wanted awalogo to serve both sides of the product-development process.

For designers, it needed to make logos easy to find and insert into their work. For developers, it needed to provide optimized assets and structured information that could eventually support reusable packages and integrations.

Three principles guided the product:

1. **Verified sourcing:** Assets should come from official websites, brand materials, or other institution-owned sources whenever possible.

2. **Practical formats:** Logos should be available in formats suitable for different workflows, without pretending that every source is a vector.

3. **Responsible growth:** New assets should pass through review and validation instead of being added automatically.

The name **awalogo**—a familiar Nigerian expression meaning “our logo”—captured the community-driven nature of that strategy.

## Bringing the Idea to Life

The first step was creating a structured list of institutions rather than beginning with a loose folder of image files. This established the foundation for catalog coverage, search, categories, aliases, source tracking, and future updates.

Next came asset discovery. I researched official institution websites and brand-owned materials to locate the best available artwork. Because many organizations do not publish formal brand kits, this process often required careful review of website assets and official documents.

Each candidate was assessed before being accepted. Assets were checked for their source, relevance, file integrity, and relationship to the institution’s current brand. Arbitrary page images and unrelated graphics were excluded.

Approved assets were then prepared in useful formats:

- SVG where an official vector source was available.
- PNG for broad compatibility.
- WebP for efficient web use.

Raster artwork was preserved rather than automatically traced into SVG, since tracing could alter the original mark and create an inaccurate representation of the brand.

With the catalog structure in place, I built two experiences around the same underlying data:

- A searchable public website for discovering and downloading available assets.
- An offline-first Figma plugin for finding logos during the design process.

I also introduced automated validation and structured contribution workflows. These checks help identify missing files, unsafe SVG content, duplicate identifiers, and incomplete metadata. Contributors can propose new assets or corrections, but submissions still require sourcing and review.

## Outcome

awalogo has grown from a small verified seed into a catalog containing **119 reviewed logos sourced from official properties**.

The solution now provides:

- A structured catalog of Nigerian financial institutions.
- Reviewed logo assets in available SVG, PNG, and WebP formats.
- Search and filtering across the public website and Figma plugin.
- Clear source and status information.
- A process for requesting, contributing, reviewing, and correcting assets.
- A reusable technical foundation for future developer packages and integrations.

Not every institution has approved artwork available yet, and not every approved logo has an official vector version. Instead of filling those gaps with unverified images, awalogo makes incomplete coverage visible while the correct assets are researched.

## What I Learned

The project reinforced that the most valuable product opportunities often begin as small, recurring workflow problems.

It also showed me that building a trustworthy catalog requires more than collecting content. Sourcing, provenance, validation, maintenance, and contribution rules are part of the product itself.

Finally, starting with a focused market made the idea more useful. Concentrating on Nigerian financial institutions provided a clear audience, a measurable coverage goal, and a practical foundation for expansion.

## The Future

The vision for awalogo extends beyond Nigerian financial services.

The next stage is to deepen coverage across banks, fintechs, regulators, insurers, and related institutions while continuing to improve the design and developer experience. From there, I plan to expand into other Nigerian industries and eventually include institutions from other African and international markets.

awalogo is open source so designers, developers, institutions, and contributors can help shape that future.

The supporting code and tools are available for community use and contribution. All logo assets remain trademarks of their respective owners, and their inclusion does not imply ownership, endorsement, or affiliation.

**Explore awalogo at [awalogo.com](https://awalogo.com), use it in your next project, or help improve the catalog by contributing a verified asset or correction.**

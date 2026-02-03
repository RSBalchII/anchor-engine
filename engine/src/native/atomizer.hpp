#pragma once
#include <string>
#include <string_view>
#include <vector>

namespace ECE {
    // We return a simple struct that N-API logic can easily convert to JS Array
    struct AtomResult {
        std::string content; // For now, we copy to string to return to JS
        // Optimally, we would return {start, length} and let JS slice, 
        // but creating a new V8 string from C++ string is often cleaner for the API.
    };

    class Atomizer {
    public:
        // Main Entry point
        static std::vector<std::string> Atomize(const std::string& content, const std::string& strategy);

    private:
        // Strategy: "code" (Line-based + Bracket balancing)
        static std::vector<std::string> SplitCode(const std::string& content);
        
        // Strategy: "prose" (Sentence/Paragraph based)
        static std::vector<std::string> SplitProse(const std::string& content);
    };
}

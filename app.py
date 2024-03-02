class Section():
    # a section has left and right boundaries, and top and bottom boundaries
    def __init__(self, left, right, top, bottom):
        self.left = left
        self.right = right
        self.top = top
        self.bottom = bottom
        
    def is_inside(self, x, y):
        return self.left <= x <= self.right and self.top <= y <= self.bottom
        

class Map():
    NUM_SECTIONS = 9
    
    def __init__(self, map_width, map_height):
        # initialize the map that hold the boundaries of the map sections
        self.map_width = map_width
        self.map_height = map_height
        self.map_sections = self.create_map_sections(map_width, map_height)
        self.section_lookup = self.create_section_lookup()
        
    def create_map_sections(self, map_width, map_height):
        # divide the map into 9 sections, split into 3 columns and 3 rows
        map_sections = {
            "NW": Section(0, map_width/3, 0, map_height/3),
            "N": Section(map_width/3, 2*map_width/3, 0, map_height/3),
            "NE": Section(2*map_width/3, map_width, 0, map_height/3),
            "W": Section(0, map_width/3, map_height/3, 2*map_height/3),
            "C": Section(map_width/3, 2*map_width/3, map_height/3, 2*map_height/3),
            "E": Section(2*map_width/3, map_width, map_height/3, 2*map_height/3),
            "SW": Section(0, map_width/3, 2*map_height/3, map_height),
            "S": Section(map_width/3, 2*map_width/3, 2*map_height/3, map_height),
            "SE": Section(2*map_width/3, map_width, 2*map_height/3, map_height)
        }
        
        return map_sections
    
    def section_lookup(self):
        # create a lookup table for the sections
        section_lookup = {}
        for section, boundaries in self.map_sections.items():
            section_lookup[section] = boundaries
        return section_lookup
    
    def get_section(self, x, y):
        for section, boundaries in self.map_sections.items():
            if boundaries.is_inside(x, y):
                return section
        return None